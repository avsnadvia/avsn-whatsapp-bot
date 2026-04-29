const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

/**
 * Gera mensagem motivacional diária via Perplexity
 */

const MOTIVACIONAL_PROMPT = `Você é um assistente do escritório de advocacia criminal AVSN.

Gere UMA mensagem motivacional curta e inspiradora para advogados criminalistas começarem o dia.

Regras:
- Máximo 3 parágrafos curtos
- Pode citar filósofos, juristas, escritores ou pensadores
- Alterne entre: frases sobre justiça, defesa, perseverança, coragem, ética profissional
- Não repita mensagens anteriores — seja criativo
- Tom: elegante, culto, inspirador
- Não use emojis em excesso — no máximo 1 no início
- Responda apenas com a mensagem, sem introdução

Exemplo de tom:
"A advocacia criminal é, antes de tudo, um ato de coragem. Defender quem todos acusam exige mais do que conhecimento técnico — exige caráter."`;

async function gerarMensagem() {
  try {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: config.perplexity.model,
        messages: [
          { role: 'system', content: MOTIVACIONAL_PROMPT },
          { role: 'user', content: `Gere a mensagem motivacional do dia (${new Date().toLocaleDateString('pt-BR')}).` },
        ],
        max_tokens: 500,
        temperature: 0.9,
      },
      {
        headers: {
          Authorization: `Bearer ${config.perplexity.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const mensagem = response.data.choices[0].message.content;
    return `*Bom dia, AVSN!*\n\n${mensagem}`;
  } catch (error) {
    logger.error('Erro ao gerar mensagem motivacional', { error: error.message });
    // Fallback com mensagens fixas
    return getFallback();
  }
}

/**
 * Fallback caso a API falhe
 */
function getFallback() {
  const mensagens = [
    '*Bom dia, AVSN!*\n\n"A injustiça que se faz a um é uma ameaça que se faz a todos." — Montesquieu\n\nQue o dia de hoje seja de luta firme e técnica precisa.',
    '*Bom dia, AVSN!*\n\n"O advogado é indispensável à administração da justiça." — Art. 133, CF/88\n\nMais do que indispensável: somos a última trincheira entre o Estado e a liberdade.',
    '*Bom dia, AVSN!*\n\n"Prefiro a inquietude da dúvida à certeza do erro." — Rui Barbosa\n\nBom trabalho a todos.',
    '*Bom dia, AVSN!*\n\n"A verdadeira medida de um homem não é como ele se comporta em momentos de conforto, mas como ele se mantém em tempos de controvérsia." — Martin Luther King Jr.\n\nForça e técnica para o dia de hoje.',
    '*Bom dia, AVSN!*\n\n"Onde não há defesa, não há justiça." — Nelson Hungria\n\nQue cada petição, cada sustentação, cada recurso nosso faça diferença.',
  ];
  const index = new Date().getDate() % mensagens.length;
  return mensagens[index];
}

module.exports = { gerarMensagem };
