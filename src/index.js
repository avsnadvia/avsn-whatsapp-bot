const express = require('express');
const cron = require('node-cron');
const config = require('./config');
const logger = require('./logger');
const evolution = require('./services/evolution');
const monitor = require('./services/monitor');
const motivacional = require('./services/motivacional');
const { handleIncoming } = require('./handlers/message');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', instance: config.evolution.instance });
});

// Webhook da Evolution API — recebe mensagens
app.post(config.bot.webhookPath, async (req, res) => {
  // Responde imediatamente para não travar o webhook
  res.sendStatus(200);

  try {
    const event = req.body;

    // Evolution API envia evento MESSAGES_UPSERT
    if (event.event === 'messages.upsert') {
      const data = event.data;
      await handleIncoming(data);
    }
  } catch (error) {
    logger.error('Erro no webhook', { error: error.message });
  }
});

/**
 * Cron job do monitor de publicações
 * Verifica todos os termos monitorados e envia alertas via WhatsApp
 */
function startMonitorCron() {
  if (!config.monitor.enabled) {
    logger.info('Monitor de publicações desativado');
    return;
  }

  const schedule = config.monitor.cronSchedule;

  if (!cron.validate(schedule)) {
    logger.error('Cron schedule inválido', { schedule });
    return;
  }

  cron.schedule(schedule, async () => {
    logger.info('Executando verificação do monitor de publicações');

    const allMonitors = monitor.getAllMonitors();
    const senders = Object.keys(allMonitors);

    if (senders.length === 0) {
      logger.info('Nenhum monitor ativo');
      return;
    }

    for (const sender of senders) {
      const { termos } = allMonitors[sender];
      if (!termos || termos.length === 0) continue;

      const remoteJid = `${sender}@s.whatsapp.net`;

      for (const termo of termos) {
        try {
          const result = await monitor.searchPublicacoes(termo);

          // Verifica se o resultado indica que não há publicações
          const semResultado = result.toLowerCase().includes('não foram encontrad')
            || result.toLowerCase().includes('não há publicações')
            || result.toLowerCase().includes('nenhuma publicação');

          if (!semResultado) {
            await evolution.sendText(remoteJid,
              `📰 *Alerta de Monitor*\n\n*Termo:* ${termo}\n\n${result}`
            );
          }

          // Intervalo entre consultas para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          logger.error('Erro no monitor automático', { sender, termo, error: error.message });
        }
      }
    }

    logger.info('Verificação do monitor concluída');
  }, {
    timezone: 'America/Sao_Paulo',
  });

  logger.info(`Monitor de publicações ativo — cron: ${schedule} (America/Sao_Paulo)`);
}

/**
 * Cron job de mensagem motivacional diária
 * Envia para todos os números autorizados às 8h (São Paulo)
 */
function startMotivacionalCron() {
  const schedule = config.motivacional?.cronSchedule || '0 8 * * *';

  if (config.motivacional?.enabled === false) {
    logger.info('Mensagem motivacional desativada');
    return;
  }

  cron.schedule(schedule, async () => {
    logger.info('Enviando mensagem motivacional diária');

    try {
      const mensagem = await motivacional.gerarMensagem();
      const destinatarios = config.motivacional.numbers.length > 0
        ? config.motivacional.numbers
        : config.authorizedNumbers;

      if (destinatarios.length === 0) {
        logger.warn('Nenhum destinatário para mensagem motivacional');
        return;
      }

      for (const numero of destinatarios) {
        const remoteJid = `${numero}@s.whatsapp.net`;
        try {
          await evolution.sendText(remoteJid, mensagem);
          logger.info('Motivacional enviada', { to: numero });
        } catch (err) {
          logger.error('Erro ao enviar motivacional', { to: numero, error: err.message });
        }
        // Pequeno intervalo entre envios
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      logger.error('Erro ao gerar mensagem motivacional', { error: error.message });
    }
  }, {
    timezone: 'America/Sao_Paulo',
  });

  logger.info(`Mensagem motivacional ativa — cron: ${schedule} (America/Sao_Paulo)`);
}

// Setup e inicialização
async function start() {
  // Garante diretório de logs
  const fs = require('fs');
  if (!fs.existsSync('logs')) fs.mkdirSync('logs');

  // Valida configuração mínima
  if (!config.evolution.apiKey) {
    logger.error('EVOLUTION_API_KEY não configurada. Verifique o .env');
    process.exit(1);
  }
  if (!config.perplexity.apiKey) {
    logger.error('PERPLEXITY_API_KEY não configurada. Verifique o .env');
    process.exit(1);
  }

  // Aviso sobre OpenAI (não obrigatório)
  if (!config.openai?.apiKey) {
    logger.warn('OPENAI_API_KEY não configurada — análise de documentos desativada');
  }

  // Inicia cron do monitor
  startMonitorCron();

  // Inicia cron da mensagem motivacional
  startMotivacionalCron();

  // Inicia servidor
  app.listen(config.bot.port, () => {
    logger.info(`Bot AVSN rodando na porta ${config.bot.port}`);
    logger.info(`Webhook: http://localhost:${config.bot.port}${config.bot.webhookPath}`);
    logger.info(`Números autorizados: ${config.authorizedNumbers.length > 0 ? config.authorizedNumbers.join(', ') : 'TODOS (sem restrição)'}`);
  });
}

start().catch(error => {
  logger.error('Erro fatal na inicialização', { error: error.message });
  process.exit(1);
});
