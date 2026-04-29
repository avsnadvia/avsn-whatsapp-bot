const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

/**
 * Análise de documentos (PDF e imagens) recebidos via WhatsApp
 *
 * Fluxo:
 * 1. Recebe mensagem com mídia (document ou imageMessage)
 * 2. Baixa o arquivo via Evolution API (getBase64FromMediaMessage)
 * 3. Envia para OpenAI GPT-4o (vision) para análise
 *
 * Suporte: PDF, imagens (jpg, png, webp)
 */

const ANALYSIS_PROMPT = `Você é um assistente jurídico do escritório de advocacia criminal AVSN (Alamiro Velludo Salvador Netto Advogados Associados).

Analise o documento/imagem recebido e forneça:

1. *Tipo do documento*: identifique se é petição, decisão judicial, sentença, acórdão, despacho, ofício, mandado, certidão, auto de prisão, denúncia, relatório policial, inquérito, etc.

2. *Resumo*: síntese objetiva do conteúdo principal.

3. *Dados processuais* (quando identificáveis):
   - Número do processo
   - Vara/Tribunal
   - Partes envolvidas
   - Juiz(a)/Relator(a)

4. *Pontos de atenção para a defesa*:
   - Prazos mencionados
   - Decisões desfavoráveis
   - Nulidades aparentes
   - Oportunidades processuais

5. *Próximos passos sugeridos*

Responda em português brasileiro, com linguagem técnico-jurídica precisa.
Se a imagem/documento não for legível ou não for jurídico, informe ao usuário.`;

/**
 * Baixa mídia de uma mensagem via Evolution API
 * Retorna o base64 do arquivo
 */
async function downloadMedia(messageData) {
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
    logger.error('Erro ao baixar mídia', {
      status: error.response?.status,
      data: error.response?.data,
    });
    throw new Error('Não foi possível baixar o arquivo.');
  }
}

/**
 * Analisa documento/imagem via OpenAI GPT-4o Vision
 */
async function analyzeWithVision(base64Data, mimeType, userContext) {
  if (!config.openai?.apiKey) {
    throw new Error('OPENAI_API_KEY não configurada. Configure para usar análise de documentos.');
  }

  const mediaType = mimeType || 'image/jpeg';

  // Para PDFs, precisamos converter para imagem ou usar text extraction
  // GPT-4o aceita imagens diretamente; para PDF, enviamos como file
  const isImage = mediaType.startsWith('image/');
  const isPdf = mediaType === 'application/pdf';

  let messages;

  if (isImage) {
    messages = [
      { role: 'system', content: ANALYSIS_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userContext
              ? `Analise este documento. Contexto adicional: ${userContext}`
              : 'Analise este documento jurídico.',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mediaType};base64,${base64Data}`,
              detail: 'high',
            },
          },
        ],
      },
    ];
  } else if (isPdf) {
    // GPT-4o suporta PDFs via input files na API
    messages = [
      { role: 'system', content: ANALYSIS_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userContext
              ? `Analise este documento PDF. Contexto adicional: ${userContext}`
              : 'Analise este documento PDF jurídico.',
          },
          {
            type: 'file',
            file: {
              filename: 'documento.pdf',
              file_data: `data:application/pdf;base64,${base64Data}`,
            },
          },
        ],
      },
    ];
  } else {
    throw new Error(`Tipo de arquivo não suportado: ${mediaType}. Envie imagens (JPG/PNG) ou PDFs.`);
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages,
        max_tokens: 3000,
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    logger.error('Erro na análise OpenAI', {
      status: error.response?.status,
      data: error.response?.data,
    });
    throw new Error('Não foi possível analisar o documento. Tente novamente.');
  }
}

/**
 * Fluxo completo: baixa mídia + analisa
 */
async function analyzeDocument(messageData, mimeType, userContext) {
  // 1. Baixa a mídia
  const mediaResult = await downloadMedia(messageData);
  const base64 = mediaResult.base64;

  if (!base64) {
    throw new Error('Não foi possível extrair o conteúdo do arquivo.');
  }

  // 2. Analisa com IA
  const analysis = await analyzeWithVision(base64, mimeType, userContext);

  return analysis;
}

module.exports = { analyzeDocument, downloadMedia, analyzeWithVision };
