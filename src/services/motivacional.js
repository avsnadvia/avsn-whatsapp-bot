const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

/**
 * Gera frase motivacional curta para envio diário
 */

const MOTIVACIONAL_PROMPT = `Responda APENAS com uma frase motivacional curta. Nada mais.

Regras:
- Uma única frase curta (máximo 2 linhas)
- Pode ser de filósofos, juristas, escritores, pensadores ou própria
- Sem indicar o autor, sem fonte, sem aspas no nome
- Sem reflexão, sem comentário, sem emoji, sem título
- Alterne temas: coragem, perseverança, justiça, trabalho, superação, propósito
- Varie bastante, não repita frases conhecidas demais

Exemplos:
"A coragem não é a ausência do medo, mas a decisão de que algo é mais importante que o medo."
"Grandes batalhas só são dadas a grandes guerreiros."
"O sucesso nasce do querer, da determinação e persistência em se chegar a um objetivo."
"Quem luta com bravura, ainda que caia, jamais será derrotado."`;

async function gerarMensagem() {
  try {
    const hoje = new Date();
    const seed = `${hoje.getFullYear()}-${hoje.getMonth()}-${hoje.getDate()}`;

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: config.perplexity.model,
        messages: [
          { role: 'system', content: MOTIVACIONAL_PROMPT },
          { role: 'user', content: `Frase motivacional do dia (seed: ${seed}).` },
        ],
        max_tokens: 150,
        temperature: 0.95,
      },
      {
        headers: {
          Authorization: `Bearer ${config.perplexity.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Erro ao gerar mensagem motivacional', { error: error.message });
    return getFallback();
  }
}

function getFallback() {
  const frases = [
    '"A coragem não é a ausência do medo, mas a decisão de que algo é mais importante que o medo."',
    '"Grandes batalhas só são dadas a grandes guerreiros."',
    '"O sucesso nasce do querer, da determinação e persistência em se chegar a um objetivo."',
    '"Quem luta com bravura, ainda que caia, jamais será derrotado."',
    '"Não espere por uma crise para descobrir o que é importante na sua vida."',
    '"A persistência é o caminho do êxito."',
    '"Faça o teu melhor, na condição que você tem, enquanto você não tem condições melhores."',
    '"A diferença entre o ordinário e o extraordinário é esse pequeno extra."',
    '"Discipline é a ponte entre metas e conquistas."',
    '"Só é derrotado quem desiste. Todos os outros estão a caminho da vitória."',
    '"A força não vem de vencer. Suas lutas desenvolvem suas forças."',
    '"Cada dia é uma nova chance de mudar sua vida."',
    '"O único lugar onde o sucesso vem antes do trabalho é no dicionário."',
    '"Acredite que você pode e já estará no meio do caminho."',
    '"Não é sobre ter tempo, é sobre fazer tempo para o que importa."',
  ];
  const index = new Date().getDate() % frases.length;
  return frases[index];
}

module.exports = { gerarMensagem };
