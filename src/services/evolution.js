const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

const api = axios.create({
  baseURL: config.evolution.apiUrl,
  headers: {
    apikey: config.evolution.apiKey,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/**
 * Envia mensagem de texto pelo WhatsApp
 */
async function sendText(remoteJid, text) {
  try {
    await api.post(`/message/sendText/${config.evolution.instance}`, {
      number: remoteJid,
      text,
    });
    logger.info('Mensagem enviada', { to: remoteJid });
  } catch (error) {
    logger.error('Erro ao enviar mensagem', {
      to: remoteJid,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
}

/**
 * Envia reação a uma mensagem (feedback visual de "processando")
 */
async function sendReaction(remoteJid, messageId, emoji) {
  try {
    await api.post(`/message/sendReaction/${config.evolution.instance}`, {
      key: {
        remoteJid,
        id: messageId,
      },
      reaction: emoji,
    });
  } catch (error) {
    logger.warn('Erro ao enviar reação', { error: error.message });
  }
}

/**
 * Cria instância na Evolution API (setup inicial)
 */
async function createInstance() {
  try {
    const response = await api.post('/instance/create', {
      instanceName: config.evolution.instance,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    });
    logger.info('Instância criada', { instance: config.evolution.instance });
    return response.data;
  } catch (error) {
    if (error.response?.status === 403) {
      logger.info('Instância já existe');
      return null;
    }
    throw error;
  }
}

/**
 * Configura webhook para receber mensagens
 */
async function configureWebhook(webhookUrl) {
  try {
    await api.post(`/webhook/set/${config.evolution.instance}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: true,
        events: ['MESSAGES_UPSERT'],
      },
    });
    logger.info('Webhook configurado', { url: webhookUrl });
  } catch (error) {
    logger.error('Erro ao configurar webhook', { error: error.message });
    throw error;
  }
}

/**
 * Busca QR Code para conexão
 */
async function getQrCode() {
  try {
    const response = await api.get(`/instance/connect/${config.evolution.instance}`);
    return response.data;
  } catch (error) {
    logger.error('Erro ao obter QR Code', { error: error.message });
    throw error;
  }
}

module.exports = { sendText, sendReaction, createInstance, configureWebhook, getQrCode };
