const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');
const logger = require('../logger');

/**
 * Transcrição de áudio via OpenAI Whisper
 */

/**
 * Baixa áudio de mensagem WhatsApp via Evolution API
 */
async function downloadAudio(messageData) {
  try {
    const response = await axios.post(
      `${config.evolution.apiUrl}/chat/getBase64FromMediaMessage/${config.evolution.instance}`,
      {
        message: messageData,
        convertToMp4: false,
      },
      {
        headers: {
          apikey: config.evolution.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );
    return response.data;
  } catch (error) {
    logger.error('Erro ao baixar áudio', { error: error.message });
    throw new Error('Não foi possível baixar o áudio.');
  }
}

/**
 * Transcreve áudio usando OpenAI Whisper
 */
async function transcribeAudio(base64Data, mimeType) {
  if (!config.openai?.apiKey) {
    throw new Error('OPENAI_API_KEY não configurada. Necessária para transcrição de áudio.');
  }

  // Converte base64 para buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Determina extensão
  const ext = mimeType?.includes('ogg') ? 'ogg'
    : mimeType?.includes('mp4') ? 'mp4'
    : mimeType?.includes('mpeg') ? 'mp3'
    : 'ogg';

  const form = new FormData();
  form.append('file', buffer, { filename: `audio.${ext}`, contentType: mimeType || 'audio/ogg' });
  form.append('model', 'whisper-1');
  form.append('language', 'pt');

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
          ...form.getHeaders(),
        },
        timeout: 60000,
        maxContentLength: 25 * 1024 * 1024,
      }
    );

    return response.data.text;
  } catch (error) {
    logger.error('Erro na transcrição Whisper', {
      status: error.response?.status,
      data: error.response?.data,
    });
    throw new Error('Não foi possível transcrever o áudio.');
  }
}

module.exports = { downloadAudio, transcribeAudio };
