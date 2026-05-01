const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

/**
 * Gerenciamento de agenda via linguagem natural
 *
 * Usa IA para extrair dados de eventos de texto livre (ou áudio transcrito).
 * Armazena eventos em JSON local.
 */

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const AGENDA_FILE = path.join(DATA_DIR, 'agenda.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAgenda() {
  ensureDataDir();
  if (!fs.existsSync(AGENDA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(AGENDA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveAgenda(events) {
  ensureDataDir();
  fs.writeFileSync(AGENDA_FILE, JSON.stringify(events, null, 2), 'utf-8');
}

/**
 * Usa IA para extrair dados estruturados de uma solicitação em linguagem natural
 */
const PARSE_PROMPT = `Você é um assistente que extrai dados de agendamento a partir de texto em linguagem natural.

A data de hoje é: {{DATA_HOJE}}

Extraia os dados e responda APENAS em JSON válido, sem markdown, sem explicação. Formato:

{
  "acao": "agendar" | "listar" | "cancelar" | "hoje" | "semana",
  "titulo": "descrição do evento",
  "participantes": ["nome1", "nome2"],
  "data": "YYYY-MM-DD",
  "hora": "HH:MM",
  "duracao": 60,
  "observacoes": ""
}

Regras:
- Se não informar hora, use "09:00" como padrão
- Se disser "amanhã", calcule a data correta
- Se disser "segunda", "terça" etc., calcule a próxima ocorrência
- Se disser "semana que vem", calcule
- Duração padrão: 60 minutos
- Se pedir para "ver agenda", "compromissos", "o que tenho", acao = "listar"
- Se pedir "agenda de hoje", acao = "hoje"
- Se pedir "agenda da semana", acao = "semana"
- Se pedir para "cancelar" ou "remover", acao = "cancelar"
- Responda SOMENTE o JSON, nada mais`;

async function parseComando(texto) {
  const hoje = new Date();
  const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')} (${['domingo','segunda','terça','quarta','quinta','sexta','sábado'][hoje.getDay()]})`;

  const prompt = PARSE_PROMPT.replace('{{DATA_HOJE}}', dataHoje);

  try {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: config.perplexity.model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: texto },
        ],
        max_tokens: 300,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${config.perplexity.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices[0].message.content.trim();
    // Remove possíveis blocos de código markdown
    const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    logger.error('Erro ao parsear comando de agenda', { error: error.message });
    throw new Error('Não consegui entender o pedido. Tente algo como:\n_Agendar reunião com Inês amanhã às 14h_');
  }
}

/**
 * Agenda um novo evento
 */
function agendarEvento(evento) {
  const events = loadAgenda();

  const newEvent = {
    id: Date.now().toString(),
    titulo: evento.titulo,
    participantes: evento.participantes || [],
    data: evento.data,
    hora: evento.hora || '09:00',
    duracao: evento.duracao || 60,
    observacoes: evento.observacoes || '',
    criadoEm: new Date().toISOString(),
  };

  events.push(newEvent);
  saveAgenda(events);

  const participantesStr = newEvent.participantes.length > 0
    ? `\n*Participantes:* ${newEvent.participantes.join(', ')}`
    : '';

  return `✅ *Agendado!*\n\n` +
    `*${newEvent.titulo}*\n` +
    `*Data:* ${formatarData(newEvent.data)}\n` +
    `*Horário:* ${newEvent.hora}\n` +
    `*Duração:* ${newEvent.duracao} min` +
    participantesStr +
    (newEvent.observacoes ? `\n*Obs:* ${newEvent.observacoes}` : '');
}

/**
 * Lista eventos de um período
 */
function listarEventos(filtro) {
  const events = loadAgenda();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let filtrados;
  let titulo;

  if (filtro === 'hoje') {
    const hojeStr = formatDate(hoje);
    filtrados = events.filter(e => e.data === hojeStr);
    titulo = `*Agenda de hoje (${formatarData(hojeStr)}):*`;
  } else if (filtro === 'semana') {
    const fimSemana = new Date(hoje);
    fimSemana.setDate(fimSemana.getDate() + 7);
    const hojeStr = formatDate(hoje);
    const fimStr = formatDate(fimSemana);
    filtrados = events.filter(e => e.data >= hojeStr && e.data <= fimStr);
    titulo = '*Agenda da semana:*';
  } else {
    // Próximos eventos (a partir de hoje)
    const hojeStr = formatDate(hoje);
    filtrados = events.filter(e => e.data >= hojeStr);
    titulo = '*Próximos compromissos:*';
  }

  // Ordena por data e hora
  filtrados.sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    return a.hora.localeCompare(b.hora);
  });

  if (filtrados.length === 0) {
    return `${titulo}\n\nNenhum compromisso encontrado.`;
  }

  const lista = filtrados.map(e => {
    const participantes = e.participantes?.length > 0 ? ` (${e.participantes.join(', ')})` : '';
    return `▸ *${formatarData(e.data)}* ${e.hora} — ${e.titulo}${participantes}`;
  }).join('\n');

  return `${titulo}\n\n${lista}`;
}

/**
 * Cancela um evento por título (busca parcial)
 */
function cancelarEvento(titulo) {
  const events = loadAgenda();
  const tituloLower = titulo.toLowerCase();

  const index = events.findIndex(e =>
    e.titulo.toLowerCase().includes(tituloLower)
  );

  if (index === -1) {
    return `⚠️ Evento "${titulo}" não encontrado na agenda.`;
  }

  const removido = events.splice(index, 1)[0];
  saveAgenda(events);

  return `✅ *Cancelado:*\n${removido.titulo} — ${formatarData(removido.data)} ${removido.hora}`;
}

// Helpers
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatarData(dateStr) {
  const [ano, mes, dia] = dateStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

module.exports = { parseComando, agendarEvento, listarEventos, cancelarEvento };
