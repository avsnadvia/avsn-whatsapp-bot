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
  openai: {
    apiKey: process.env.OPENAI_API_KEY, // para análise de documentos (GPT-4o Vision)
  },
  monitor: {
    enabled: process.env.MONITOR_ENABLED !== 'false', // ativo por padrão
    cronSchedule: process.env.MONITOR_CRON || '0 8,13,18 * * 1-5', // 8h, 13h, 18h seg-sex
  },
  motivacional: {
    enabled: process.env.MOTIVACIONAL_ENABLED !== 'false',
    cronSchedule: process.env.MOTIVACIONAL_CRON || '0 8 * * *',
    numbers: (process.env.MOTIVACIONAL_NUMBERS || '')
      .split(',')
      .map(n => n.trim())
      .filter(Boolean),
  },
  biblia: {
    enabled: process.env.BIBLIA_ENABLED !== 'false',
    cronSchedule: process.env.BIBLIA_CRON || '15 7 * * *',
    numbers: (process.env.BIBLIA_NUMBERS || '')
      .split(',')
      .map(n => n.trim())
      .filter(Boolean),
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
