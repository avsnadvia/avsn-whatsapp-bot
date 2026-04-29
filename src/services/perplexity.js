const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

const SYSTEM_PROMPT = `Você é um assistente de pesquisa jurídica do escritório de advocacia criminal AVSN (Alamiro Velludo Salvador Netto Advogados Associados).

Ao receber uma pergunta:
1. Pesquise informações atualizadas na internet
2. Priorize fontes confiáveis: sites de tribunais, Diários Oficiais, portais jurídicos (ConJur, Migalhas, JOTA), veículos de imprensa consolidados
3. Quando a pergunta for sobre operações policiais, identifique:
   - Nome da operação e órgão responsável (PF, MP, Polícia Civil)
   - Investigados/denunciados conhecidos publicamente
   - Tipos penais imputados
   - Fase atual (inquérito, denúncia, sentença, recurso)
   - Vara/Tribunal competente
4. Sempre indique as fontes consultadas
5. Responda em português brasileiro
6. Seja objetivo e técnico, mas claro

IMPORTANTE: Forneça apenas informações de domínio público. Não especule sobre fatos não confirmados.`;

async function search(userMessage) {
  try {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: config.perplexity.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 2048,
        temperature: 0.1,
        return_citations: true,
        search_recency_filter: 'month', // prioriza resultados recentes
      },
      {
        headers: {
          Authorization: `Bearer ${config.perplexity.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const result = response.data.choices[0].message.content;
    const citations = response.data.citations || [];

    let reply = result;
    if (citations.length > 0) {
      reply += '\n\n📎 *Fontes:*\n' + citations.map((c, i) => `${i + 1}. ${c}`).join('\n');
    }

    return reply;
  } catch (error) {
    logger.error('Erro na Perplexity API', {
      status: error.response?.status,
      data: error.response?.data,
    });
    throw new Error('Não foi possível realizar a pesquisa. Tente novamente em instantes.');
  }
}

module.exports = { search };
