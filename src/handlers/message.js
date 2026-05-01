const config = require('../config');
const logger = require('../logger');
const perplexity = require('../services/perplexity');
const evolution = require('../services/evolution');
const jurisprudencia = require('../services/jurisprudencia');
const monitor = require('../services/monitor');
const documentAnalysis = require('../services/documentAnalysis');
const motivacional = require('../services/motivacional');
const biblia = require('../services/biblia');
const mercado = require('../services/mercado');
const audio = require('../services/audio');
const agenda = require('../services/agenda');

// Prefixos de comando — extensível para novos módulos
const COMMANDS = {
  '/pesquisar': handleSearch,
  '/buscar': handleSearch,
  '/jurisprudencia': handleJurisprudencia,
  '/juris': handleJurisprudencia,
  '/monitor': handleMonitor,
  '/documento': handleDocumentoCommand,
  '/doc': handleDocumentoCommand,
  '/motivacional': handleMotivacional,
  '/biblia': handleBiblia,
  '/mercado': handleMercado,
  '/agenda': handleAgenda,
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

  // Detecta se a mensagem contém mídia (documento ou imagem)
  const hasDocument = !!data.message?.documentMessage;
  const hasImage = !!data.message?.imageMessage;
  const hasAudio = !!data.message?.audioMessage;
  const hasMedia = hasDocument || hasImage;

  // Caption de mídia (texto junto com imagem/doc)
  const mediaCaption = data.message?.documentMessage?.caption
    || data.message?.imageMessage?.caption
    || '';

  if (!remoteJid) return;
  if (!text && !hasMedia && !hasAudio) return;

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
    // Se recebeu áudio, transcreve e processa como texto
    if (hasAudio) {
      await handleAudioMessage(remoteJid, messageId, data.message, sender);
      return;
    }

    // Se recebeu mídia (imagem ou documento), trata como análise de documento
    if (hasMedia) {
      await handleDocumentoMedia(remoteJid, messageId, data.message, mediaCaption, sender);
      return;
    }

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
 * Pesquisa de jurisprudência
 */
async function handleJurisprudencia(remoteJid, messageId, query, sender) {
  if (!query) {
    await evolution.sendText(remoteJid,
      '*Pesquisa de Jurisprudência*\n\n' +
      'Envie o tema após o comando. Exemplos:\n' +
      '• _/juris prisão preventiva fundamentação genérica_\n' +
      '• _/juris tráfico privilegiado substituição pena_\n' +
      '• _/juris HC trancamento ação penal justa causa_\n' +
      '• _/juris lavagem de dinheiro autolavagem_'
    );
    return;
  }

  logger.info('Jurisprudência solicitada', { sender, query: query.substring(0, 80) });
  await evolution.sendReaction(remoteJid, messageId, '⚖️');

  const result = await jurisprudencia.searchJurisprudencia(query);

  if (result.length > 4000) {
    const parts = splitMessage(result, 4000);
    for (const part of parts) {
      await evolution.sendText(remoteJid, part);
    }
  } else {
    await evolution.sendText(remoteJid, result);
  }

  await evolution.sendReaction(remoteJid, messageId, '✅');
}

/**
 * Gerenciamento do monitor de publicações
 * Subcomandos: adicionar, remover, listar, consultar
 */
async function handleMonitor(remoteJid, messageId, args, sender) {
  const parts = args.split(/\s+/);
  const subcommand = (parts[0] || '').toLowerCase();
  const termo = parts.slice(1).join(' ').trim();

  switch (subcommand) {
    case 'adicionar':
    case 'add': {
      if (!termo) {
        await evolution.sendText(remoteJid, 'Informe o termo a monitorar.\nEx: _/monitor adicionar Fulano de Tal_');
        return;
      }
      const result = monitor.addTermo(sender, termo);
      const emoji = result.success ? '✅' : '⚠️';
      await evolution.sendText(remoteJid, `${emoji} ${result.message}`);
      break;
    }

    case 'remover':
    case 'rem':
    case 'del': {
      if (!termo) {
        await evolution.sendText(remoteJid, 'Informe o termo a remover.\nEx: _/monitor remover Fulano de Tal_');
        return;
      }
      const result = monitor.removeTermo(sender, termo);
      const emoji = result.success ? '✅' : '⚠️';
      await evolution.sendText(remoteJid, `${emoji} ${result.message}`);
      break;
    }

    case 'listar':
    case 'lista':
    case 'list': {
      const termos = monitor.listTermos(sender);
      if (termos.length === 0) {
        await evolution.sendText(remoteJid, 'Você não tem termos monitorados.\nUse: _/monitor adicionar [termo]_');
      } else {
        const lista = termos.map((t, i) => `${i + 1}. ${t}`).join('\n');
        await evolution.sendText(remoteJid, `*Termos monitorados (${termos.length}):*\n\n${lista}`);
      }
      break;
    }

    case 'consultar':
    case 'buscar':
    case 'check': {
      // Consulta manual imediata de um termo
      const termoBusca = termo || null;
      if (!termoBusca) {
        // Consulta todos os termos do usuário
        const termos = monitor.listTermos(sender);
        if (termos.length === 0) {
          await evolution.sendText(remoteJid, 'Nenhum termo monitorado. Adicione com _/monitor adicionar [termo]_');
          return;
        }
        await evolution.sendReaction(remoteJid, messageId, '📰');
        for (const t of termos) {
          try {
            const result = await monitor.searchPublicacoes(t);
            await evolution.sendText(remoteJid, `*Monitor: ${t}*\n\n${result}`);
          } catch (err) {
            await evolution.sendText(remoteJid, `⚠️ Erro ao consultar "${t}": ${err.message}`);
          }
        }
        await evolution.sendReaction(remoteJid, messageId, '✅');
        return;
      }

      await evolution.sendReaction(remoteJid, messageId, '📰');
      const result = await monitor.searchPublicacoes(termoBusca);
      await evolution.sendText(remoteJid, `*Publicações: ${termoBusca}*\n\n${result}`);
      await evolution.sendReaction(remoteJid, messageId, '✅');
      break;
    }

    default: {
      await evolution.sendText(remoteJid,
        '*Monitor de Publicações (DJe/DOU)*\n\n' +
        'Monitore nomes, processos e temas nos diários oficiais.\n\n' +
        '*Subcomandos:*\n' +
        '/monitor adicionar [termo] — adiciona termo\n' +
        '/monitor remover [termo] — remove termo\n' +
        '/monitor listar — lista seus termos\n' +
        '/monitor consultar — busca agora todos os termos\n' +
        '/monitor consultar [termo] — busca um termo específico\n\n' +
        '*Exemplos:*\n' +
        '• _/monitor adicionar João da Silva_\n' +
        '• _/monitor adicionar 0001234-56.2024.8.26.0050_\n' +
        '• _/monitor consultar Operação XYZ_\n\n' +
        '💡 _O bot verifica automaticamente 3x ao dia (8h, 13h, 18h) e envia alertas._'
      );
    }
  }
}

/**
 * Comando /documento — instruções para enviar documento
 */
async function handleDocumentoCommand(remoteJid, messageId, args, sender) {
  await evolution.sendText(remoteJid,
    '*Análise de Documentos*\n\n' +
    'Envie um *PDF* ou *imagem* (foto de documento) diretamente nesta conversa e eu analiso automaticamente.\n\n' +
    '*O que eu identifico:*\n' +
    '• Tipo do documento (petição, decisão, sentença, acórdão, etc.)\n' +
    '• Dados processuais (número, vara, partes)\n' +
    '• Resumo do conteúdo\n' +
    '• Pontos de atenção para a defesa\n' +
    '• Prazos e próximos passos\n\n' +
    '💡 _Você pode adicionar um texto junto com o arquivo para dar contexto. Ex: envie o PDF com a legenda "verificar prazo recursal"._'
  );
}

/**
 * Processa mídia recebida (imagem ou documento) — análise automática
 */
async function handleDocumentoMedia(remoteJid, messageId, message, caption, sender) {
  const isDocument = !!message.documentMessage;
  const isImage = !!message.imageMessage;

  let mimeType;
  let fileName;

  if (isDocument) {
    mimeType = message.documentMessage.mimetype;
    fileName = message.documentMessage.fileName || 'documento';
  } else if (isImage) {
    mimeType = message.imageMessage.mimetype || 'image/jpeg';
    fileName = 'imagem';
  }

  // Valida tipos suportados
  const supportedTypes = [
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  ];

  if (!supportedTypes.some(t => mimeType?.startsWith(t))) {
    await evolution.sendText(remoteJid,
      `⚠️ Tipo de arquivo não suportado: ${mimeType || 'desconhecido'}\n\nEnvie *PDF* ou *imagem* (JPG/PNG).`
    );
    return;
  }

  // Verifica se OpenAI está configurada
  if (!config.openai?.apiKey) {
    await evolution.sendText(remoteJid,
      '⚠️ Análise de documentos não configurada.\n' +
      'É necessário configurar a variável OPENAI_API_KEY no servidor.'
    );
    return;
  }

  logger.info('Documento recebido para análise', { sender, mimeType, fileName });
  await evolution.sendReaction(remoteJid, messageId, '📄');
  await evolution.sendText(remoteJid, '🔄 _Analisando documento... Aguarde._');

  try {
    const analysis = await documentAnalysis.analyzeDocument(message, mimeType, caption);

    const header = `*Análise: ${fileName}*\n\n`;
    const fullResult = header + analysis;

    if (fullResult.length > 4000) {
      const parts = splitMessage(fullResult, 4000);
      for (const part of parts) {
        await evolution.sendText(remoteJid, part);
      }
    } else {
      await evolution.sendText(remoteJid, fullResult);
    }

    await evolution.sendReaction(remoteJid, messageId, '✅');
  } catch (error) {
    logger.error('Erro na análise de documento', { error: error.message, sender });
    await evolution.sendText(remoteJid, `⚠️ ${error.message}`);
    await evolution.sendReaction(remoteJid, messageId, '❌');
  }
}

/**
 * Teste manual da mensagem motivacional
 */
async function handleMotivacional(remoteJid, messageId, args, sender) {
  logger.info('Motivacional solicitada manualmente', { sender });
  await evolution.sendReaction(remoteJid, messageId, '💪');

  const mensagem = await motivacional.gerarMensagem();
  await evolution.sendText(remoteJid, mensagem);
  await evolution.sendReaction(remoteJid, messageId, '✅');
}

/**
 * Teste manual da passagem bíblica
 */
async function handleBiblia(remoteJid, messageId, args, sender) {
  logger.info('Bíblia solicitada manualmente', { sender });
  await evolution.sendReaction(remoteJid, messageId, '🙏');

  const mensagem = await biblia.gerarMensagemBiblica();
  await evolution.sendText(remoteJid, mensagem);
  await evolution.sendReaction(remoteJid, messageId, '✅');
}

/**
 * Processa mensagem de áudio — transcreve e trata como comando/pesquisa
 */
async function handleAudioMessage(remoteJid, messageId, message, sender) {
  if (!config.openai?.apiKey) {
    await evolution.sendText(remoteJid,
      '⚠️ Transcrição de áudio não configurada.\nConfigure a variável OPENAI_API_KEY no servidor.'
    );
    return;
  }

  logger.info('Áudio recebido', { sender });
  await evolution.sendReaction(remoteJid, messageId, '🎙️');

  try {
    // 1. Baixa o áudio
    const mediaResult = await audio.downloadAudio(message);
    const base64 = mediaResult.base64;
    if (!base64) throw new Error('Não foi possível extrair o áudio.');

    // 2. Transcreve
    const mimeType = message.audioMessage?.mimetype || 'audio/ogg';
    const texto = await audio.transcribeAudio(base64, mimeType);

    if (!texto || texto.trim().length === 0) {
      await evolution.sendText(remoteJid, '⚠️ Não consegui entender o áudio. Tente novamente.');
      return;
    }

    logger.info('Áudio transcrito', { sender, texto: texto.substring(0, 80) });

    // 3. Verifica se é comando de agenda
    const textoLower = texto.toLowerCase();
    const isAgenda = textoLower.includes('agendar') || textoLower.includes('agenda')
      || textoLower.includes('reunião') || textoLower.includes('reuniao')
      || textoLower.includes('marcar') || textoLower.includes('compromisso')
      || textoLower.includes('cancelar reunião') || textoLower.includes('cancelar compromisso');

    if (isAgenda) {
      await handleAgenda(remoteJid, messageId, texto, sender);
    } else {
      // Trata como pesquisa normal
      await evolution.sendText(remoteJid, `🎙️ _"${texto}"_`);
      await handleSearch(remoteJid, messageId, texto, sender);
    }
  } catch (error) {
    logger.error('Erro ao processar áudio', { error: error.message, sender });
    await evolution.sendText(remoteJid, `⚠️ ${error.message}`);
    await evolution.sendReaction(remoteJid, messageId, '❌');
  }
}

/**
 * Gerenciamento de agenda via linguagem natural
 */
async function handleAgenda(remoteJid, messageId, args, sender) {
  if (!args) {
    await evolution.sendText(remoteJid,
      '*Agenda*\n\n' +
      'Envie por texto ou áudio:\n\n' +
      '• _Agendar reunião com Inês amanhã às 14h_\n' +
      '• _Marcar audiência segunda às 9h_\n' +
      '• _O que tenho hoje?_\n' +
      '• _Agenda da semana_\n' +
      '• _Cancelar reunião com Inês_\n\n' +
      '💡 _Você também pode enviar um áudio pedindo para agendar._'
    );
    return;
  }

  logger.info('Agenda solicitada', { sender, args: args.substring(0, 80) });
  await evolution.sendReaction(remoteJid, messageId, '📅');

  try {
    const parsed = await agenda.parseComando(args);

    let result;

    switch (parsed.acao) {
      case 'agendar':
        result = agenda.agendarEvento(parsed);
        break;
      case 'listar':
        result = agenda.listarEventos('todos');
        break;
      case 'hoje':
        result = agenda.listarEventos('hoje');
        break;
      case 'semana':
        result = agenda.listarEventos('semana');
        break;
      case 'cancelar':
        result = agenda.cancelarEvento(parsed.titulo);
        break;
      default:
        result = agenda.listarEventos('todos');
    }

    await evolution.sendText(remoteJid, result);
    await evolution.sendReaction(remoteJid, messageId, '✅');
  } catch (error) {
    logger.error('Erro na agenda', { error: error.message, sender });
    await evolution.sendText(remoteJid, `⚠️ ${error.message}`);
  }
}

/**
 * Teste manual do resumo do mercado
 */
async function handleMercado(remoteJid, messageId, args, sender) {
  logger.info('Mercado solicitado manualmente', { sender });
  await evolution.sendReaction(remoteJid, messageId, '📊');

  const resumo = await mercado.gerarResumoMercado();
  if (resumo.length > 4000) {
    const parts = splitMessage(resumo, 4000);
    for (const part of parts) {
      await evolution.sendText(remoteJid, part);
    }
  } else {
    await evolution.sendText(remoteJid, resumo);
  }
  await evolution.sendReaction(remoteJid, messageId, '✅');
}

/**
 * Menu de ajuda
 */
async function handleHelp(remoteJid) {
  const help = `🤖 *AVSN Bot - Assistente Jurídico*

Envie qualquer pergunta e eu pesquiso na internet para você.

*Módulos disponíveis:*

🔍 *Pesquisa Geral*
Envie sua pergunta diretamente ou use /pesquisar
• _Quem são os investigados na Operação ABC?_
• _/pesquisar prisão preventiva fundamentação_

⚖️ *Jurisprudência*
/juris [tema] — pesquisa de decisões judiciais
• _/juris tráfico privilegiado substituição pena_
• _/juris HC trancamento ação penal_

📰 *Monitor de Publicações (DJe/DOU)*
/monitor adicionar [termo] — monitorar termo
/monitor listar — ver termos monitorados
/monitor consultar — busca imediata
/monitor remover [termo] — parar de monitorar
💡 _Alertas automáticos 3x ao dia (8h, 13h, 18h)_

📄 *Análise de Documentos*
Envie um *PDF* ou *foto de documento* e eu analiso automaticamente.
• Tipo, resumo, dados processuais, pontos de atenção

*Comandos:*
/ajuda — esta mensagem
/pesquisar [texto] — pesquisa geral
/juris [tema] — jurisprudência
/monitor — gerenciar monitoramento
/doc — instruções de análise de documentos`;

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
