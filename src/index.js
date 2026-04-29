const express = require('express');
const config = require('./config');
const logger = require('./logger');
const evolution = require('./services/evolution');
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
