const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

/**
 * Monitor de publicações — DJe (Diário da Justiça Eletrônico) e DOU (Diário Oficial da União)
 *
 * Armazena termos monitorados por usuário em JSON local.
 * O cron job (iniciado em index.js) verifica periodicamente e envia alertas.
 */

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MONITORS_FILE = path.join(DATA_DIR, 'monitors.json');

// Garante diretório de dados
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Carrega monitores salvos
 * Formato: { "5511999999999": { termos: ["fulano de tal", "operação xyz"], fonte: "todos" } }
 */
function loadMonitors() {
  ensureDataDir();
  if (!fs.existsSync(MONITORS_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(MONITORS_FILE, 'utf-8'));
  } catch (error) {
    logger.error('Erro ao ler monitors.json', { error: error.message });
    return {};
  }
}

/**
 * Salva monitores no disco
 */
function saveMonitors(monitors) {
  ensureDataDir();
  fs.writeFileSync(MONITORS_FILE, JSON.stringify(monitors, null, 2), 'utf-8');
}

/**
 * Adiciona termo ao monitor de um usuário
 */
function addTermo(sender, termo) {
  const monitors = loadMonitors();
  if (!monitors[sender]) {
    monitors[sender] = { termos: [], fonte: 'todos' };
  }

  const termoLower = termo.toLowerCase().trim();

  if (monitors[sender].termos.some(t => t.toLowerCase() === termoLower)) {
    return { success: false, message: `O termo "${termo}" já está sendo monitorado.` };
  }

  if (monitors[sender].termos.length >= 20) {
    return { success: false, message: 'Limite de 20 termos monitorados atingido. Remova algum antes de adicionar.' };
  }

  monitors[sender].termos.push(termo.trim());
  saveMonitors(monitors);
  return { success: true, message: `Termo "${termo.trim()}" adicionado ao monitoramento.` };
}

/**
 * Remove termo do monitor
 */
function removeTermo(sender, termo) {
  const monitors = loadMonitors();
  if (!monitors[sender] || monitors[sender].termos.length === 0) {
    return { success: false, message: 'Você não tem termos monitorados.' };
  }

  const termoLower = termo.toLowerCase().trim();
  const index = monitors[sender].termos.findIndex(t => t.toLowerCase() === termoLower);

  if (index === -1) {
    return { success: false, message: `Termo "${termo}" não encontrado na sua lista.` };
  }

  monitors[sender].termos.splice(index, 1);
  saveMonitors(monitors);
  return { success: true, message: `Termo "${termo}" removido do monitoramento.` };
}

/**
 * Lista termos monitorados de um usuário
 */
function listTermos(sender) {
  const monitors = loadMonitors();
  if (!monitors[sender] || monitors[sender].termos.length === 0) {
    return [];
  }
  return monitors[sender].termos;
}

/**
 * Retorna todos os monitores ativos (para o cron job)
 */
function getAllMonitors() {
  return loadMonitors();
}

/**
 * Pesquisa publicações no DJe/DOU via Perplexity
 */
async function searchPublicacoes(termo) {
  const MONITOR_PROMPT = `Você é um assistente jurídico especializado em monitoramento de publicações oficiais brasileiras.

Pesquise publicações recentes (últimas 48 horas) nos seguintes diários:
- DJe (Diário da Justiça Eletrônico) do STF, STJ e TJs estaduais
- DOU (Diário Oficial da União) — seções 1, 2 e 3
- DOE (Diários Oficiais Estaduais), quando relevante

Para o termo pesquisado, identifique:
1. Tipo de publicação (decisão, despacho, portaria, nomeação, intimação, etc.)
2. Órgão publicador
3. Data da publicação
4. Resumo do conteúdo
5. Número do processo ou documento (quando aplicável)

Responda APENAS se encontrar publicações concretas. Se não houver publicações recentes, informe claramente.
Responda em português brasileiro.`;

  try {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: config.perplexity.model,
        messages: [
          { role: 'system', content: MONITOR_PROMPT },
          { role: 'user', content: `Pesquise publicações recentes no DJe e DOU sobre: ${termo}` },
        ],
        max_tokens: 2048,
        temperature: 0.1,
        return_citations: true,
        search_recency_filter: 'day',
      },
      {
        headers: {
          Authorization: `Bearer ${config.perplexity.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const result = response.data.choices[0].message.content;
    const citations = response.data.citations || [];

    let reply = result;
    if (citations.length > 0) {
      reply += '\n\n📎 *Fontes:*\n' + citations.map((c, i) => `${i + 1}. ${c}`).join('\n');
    }

    return reply;
  } catch (error) {
    logger.error('Erro ao pesquisar publicações', {
      status: error.response?.status,
      data: error.response?.data,
    });
    throw new Error('Não foi possível pesquisar publicações.');
  }
}

module.exports = {
  addTermo,
  removeTermo,
  listTermos,
  getAllMonitors,
  searchPublicacoes,
};
