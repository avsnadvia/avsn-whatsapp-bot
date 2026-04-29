require('dotenv').config();

module.exports = {
  evolution: {
    apiUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY,
    instance: process.env.EVOLUTION_INSTANCE || 'avsn-bot',
  },
  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY,
    model: 'sonar-pro', // melhor para pesquisas detalhadas
  },
  bot: {
    port: parseInt(process.env.BOT_PORT) || 3000,
    webhookPath: process.env.BOT_WEBHOOK_PATH || '/webhook/evolution',
  },
  authorizedNumbers: (process.env.AUTHORIZED_NUMBERS || '')
    .split(',')
    .map(n => n.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL || 'info',
};
