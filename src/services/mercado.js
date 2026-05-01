const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

/**
 * Resumo diário do mercado financeiro com notícias do Investidor 10
 */

const MERCADO_PROMPT = `Você é um assistente que gera um resumo matinal do mercado financeiro brasileiro.

Pesquise as principais notícias do dia no site investidor10.com.br e em fontes financeiras brasileiras.

Gere um resumo curto e direto com:
- As 5 principais notícias/destaques do mercado (1 frase cada)
- Ibovespa (último fechamento ou pré-mercado)
- Dólar (cotação)
- Se houver, destaque de ações em alta/baixa relevantes

Formato da resposta (siga exatamente):
📊 *Mercado — [data]*

▸ [notícia 1]
▸ [notícia 2]
▸ [notícia 3]
▸ [notícia 4]
▸ [notícia 5]

*Ibovespa:* [valor/variação]
*Dólar:* R$ [valor]

Regras:
- Máximo 15 linhas no total
- Frases curtas e objetivas (1 linha cada)
- Sem opinião, sem recomendação de investimento
- Foque em: bolsa brasileira, câmbio, Selic, commodities, resultados de empresas
- Priorize notícias do investidor10.com.br
- Responda em português brasileiro`;

async function gerarResumoMercado() {
  try {
    const hoje = new Date();
    const dataFormatada = hoje.toLocaleDateString('pt-BR');

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: config.perplexity.model,
        messages: [
          { role: 'system', content: MERCADO_PROMPT },
          { role: 'user', content: `Gere o resumo do mercado financeiro de hoje, ${dataFormatada}. Pesquise as últimas notícias no site investidor10.com.br e outras fontes financeiras brasileiras.` },
        ],
        max_tokens: 1000,
        temperature: 0.2,
        return_citations: true,
        search_recency_filter: 'day',
      },
      {
        headers: {
          Authorization: `Bearer ${config.perplexity.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Erro ao gerar resumo do mercado', { error: error.message });
    throw new Error('Não foi possível gerar o resumo do mercado.');
  }
}

module.exports = { gerarResumoMercado };
