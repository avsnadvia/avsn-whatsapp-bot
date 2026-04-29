const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

/**
 * Gera mensagem bíblica diária via Perplexity
 */

const BIBLIA_PROMPT = `Você é um assistente espiritual que seleciona passagens bíblicas para reflexão diária.

Gere UMA mensagem com uma passagem bíblica para o dia. Siga estas regras:

1. Escolha um versículo ou trecho bíblico (1 a 3 versículos no máximo)
2. Cite o livro, capítulo e versículo (ex: Salmos 23:1-3)
3. Transcreva o texto na versão Almeida Revista e Atualizada (ARA) ou Nova Versão Internacional (NVI)
4. Após o versículo, escreva uma breve reflexão de 2-3 frases conectando a passagem ao dia a dia — tom acolhedor e esperançoso
5. Varie os livros: alterne entre Antigo e Novo Testamento, Salmos, Provérbios, Evangelhos, Epístolas
6. Não repita passagens muito conhecidas com frequência (Salmos 23, João 3:16) — explore a riqueza da Bíblia
7. Responda apenas com a mensagem, sem introdução

Formato:
📖 [Livro Capítulo:Versículo]

"[texto do versículo]"

[reflexão breve]`;

async function gerarMensagemBiblica() {
  try {
    const hoje = new Date();
    const diaSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][hoje.getDay()];

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: config.perplexity.model,
        messages: [
          { role: 'system', content: BIBLIA_PROMPT },
          { role: 'user', content: `Gere a passagem bíblica do dia para ${diaSemana}, ${hoje.toLocaleDateString('pt-BR')}.` },
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
    return `*Palavra do Dia*\n\n${mensagem}`;
  } catch (error) {
    logger.error('Erro ao gerar mensagem bíblica', { error: error.message });
    return getFallback();
  }
}

/**
 * Fallback caso a API falhe
 */
function getFallback() {
  const mensagens = [
    '*Palavra do Dia*\n\n📖 Provérbios 3:5-6\n\n"Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento. Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas."\n\nConfie no caminho que Deus preparou. Mesmo quando não entendemos, Ele nos guia.',
    '*Palavra do Dia*\n\n📖 Isaías 41:10\n\n"Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus; eu te fortaleço, e te ajudo, e te sustento com a minha destra fiel."\n\nDeus está ao seu lado em cada desafio. Força e coragem para o dia de hoje.',
    '*Palavra do Dia*\n\n📖 Filipenses 4:13\n\n"Tudo posso naquele que me fortalece."\n\nNão é sobre a nossa força, mas sobre a fonte dela. Que Deus renove suas energias neste dia.',
    '*Palavra do Dia*\n\n📖 Romanos 8:28\n\n"Sabemos que todas as coisas cooperam para o bem daqueles que amam a Deus, daqueles que são chamados segundo o seu propósito."\n\nMesmo nos dias difíceis, Deus está tecendo algo bom. Confie no processo.',
    '*Palavra do Dia*\n\n📖 Salmos 37:5\n\n"Entrega o teu caminho ao Senhor, confia nele, e o mais ele fará."\n\nEntregue suas preocupações e confie. Ele cuida de você.',
  ];
  const index = new Date().getDate() % mensagens.length;
  return mensagens[index];
}

module.exports = { gerarMensagemBiblica };
