const config = require('../config');
const logger = require('../logger');
const perplexity = require('../services/perplexity');
const evolution = require('../services/evolution');

// Prefixos de comando — extensível para novos módulos
const COMMANDS = {
  '/pesquisar': handleSearch,
  '/buscar': handleSearch,
  '/ajuda': handleHelp,
  '/help': handleHelp,
};

// Fila simples para evitar sobrecarga
const processing = new Set();

/**
 * Handler principal de mensagens recebidas
 */
async function handleIncoming(data) {
  // Ignora mensagens enviadas pelo próprio bot
  if (data.key?.fromMe) return;

  const remoteJid = data.key?.remoteJid;
  const messageId = data.key?.id;
  const text = data.message?.conversation
    || data.message?.extendedTextMessage?.text
    || '';

  if (!text || !remoteJid) return;

  // Extrai número limpo (sem @s.whatsapp.net)
  const sender = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');

  // Controle de acesso
  if (config.authorizedNumbers.length > 0 && !config.authorizedNumbers.includes(sender)) {
    logger.warn('Acesso negado', { sender });
    return;
  }

  // Evita processar duplicatas
  if (processing.has(messageId)) return;
  processing.add(messageId);

  try {
    // Verifica se é um comando específico
    const commandKey = Object.keys(COMMANDS).find(cmd => text.toLowerCase().startsWith(cmd));

    if (commandKey) {
      const args = text.slice(commandKey.length).trim();
      await COMMANDS[commandKey](remoteJid, messageId, args, sender);
    } else {
      // Comportamento padrão: trata toda mensagem como pesquisa
      await handleSearch(remoteJid, messageId, text, sender);
    }
  } catch (error) {
    logger.error('Erro ao processar mensagem', { error: error.message, sender });
    await evolution.sendText(remoteJid, '⚠️ Erro ao processar sua mensagem. Tente novamente.');
  } finally {
    processing.delete(messageId);
  }
}

/**
 * Pesquisa na internet via Perplexity
 */
async function handleSearch(remoteJid, messageId, query, sender) {
  if (!query) {
    await evolution.sendText(remoteJid, 'Envie sua pergunta. Ex:\n_O que se sabe sobre a Operação Lava Jato?_');
    return;
  }

  logger.info('Pesquisa solicitada', { sender, query: query.substring(0, 80) });

  // Feedback visual: reação de "processando"
  await evolution.sendReaction(remoteJid, messageId, '🔍');

  const result = await perplexity.search(query);

  // WhatsApp tem limite de ~65536 chars por mensagem
  if (result.length > 4000) {
    const parts = splitMessage(result, 4000);
    for (const part of parts) {
      await evolution.sendText(remoteJid, part);
    }
  } else {
    await evolution.sendText(remoteJid, result);
  }

  // Troca reação para "concluído"
  await evolution.sendReaction(remoteJid, messageId, '✅');
}

/**
 * Menu de ajuda
 */
async function handleHelp(remoteJid) {
  const help = `🤖 *AVSN Bot - Pesquisa Jurídica*

Envie qualquer pergunta e eu pesquiso na internet para você.

*Exemplos:*
• _O que se sabe sobre a Operação XYZ?_
• _Quem são os investigados na Operação ABC?_
• _Qual a posição do STJ sobre prisão preventiva em crimes econômicos?_
• _Últimas notícias sobre o caso Fulano de Tal_

*Comandos:*
/pesquisar [texto] — pesquisa explícita
/ajuda — esta mensagem

💡 _Dica: basta enviar a pergunta diretamente, sem comando._`;

  await evolution.sendText(remoteJid, help);
}

/**
 * Divide mensagem longa em partes
 */
function splitMessage(text, maxLength) {
  const parts = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      parts.push(remaining);
      break;
    }
    // Tenta quebrar no último \n antes do limite
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = maxLength;
    }
    parts.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trimStart();
  }
  return parts;
}

module.exports = { handleIncoming };
