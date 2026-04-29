const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

/**
 * Pesquisa de jurisprudência nos tribunais brasileiros
 * Usa Perplexity com prompt especializado + APIs diretas dos tribunais
 */

const JURIS_SYSTEM_PROMPT = `Você é um assistente especializado em pesquisa de jurisprudência brasileira do escritório de advocacia criminal AVSN (Alamiro Velludo Salvador Netto Advogados Associados).

Ao receber uma consulta jurisprudencial:
1. Pesquise decisões recentes e relevantes nos tribunais superiores (STF e STJ) e tribunais estaduais
2. Para cada decisão encontrada, forneça:
   - Tribunal, Turma/Seção
   - Classe processual e número (ex: HC 123.456/SP, REsp 1.234.567/RJ)
   - Relator(a)
   - Data do julgamento
   - Ementa resumida
   - Tese firmada (quando aplicável)
3. Priorize:
   - Decisões do STJ e STF
   - Julgados mais recentes
   - Teses repetitivas e repercussão geral
   - Súmulas vinculantes e ordinárias
4. Indique se há divergência jurisprudencial sobre o tema
5. Cite as fontes (links dos tribunais quando possível)
6. Responda em português brasileiro, com linguagem técnico-jurídica

IMPORTANTE: Foque em jurisprudência penal e processual penal, salvo se a consulta for expressamente sobre outra matéria.`;

/**
 * Pesquisa jurisprudência via Perplexity (busca ampla na web)
 */
async function searchJurisprudencia(query) {
  try {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: config.perplexity.model,
        messages: [
          { role: 'system', content: JURIS_SYSTEM_PROMPT },
          { role: 'user', content: `Pesquise jurisprudência sobre: ${query}` },
        ],
        max_tokens: 3000,
        temperature: 0.1,
        return_citations: true,
        search_recency_filter: 'year',
      },
      {
        headers: {
          Authorization: `Bearer ${config.perplexity.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 90000,
      }
    );

    const result = response.data.choices[0].message.content;
    const citations = response.data.citations || [];

    let reply = `*Jurisprudência: ${query.substring(0, 60)}${query.length > 60 ? '...' : ''}*\n\n${result}`;
    if (citations.length > 0) {
      reply += '\n\n📎 *Fontes:*\n' + citations.map((c, i) => `${i + 1}. ${c}`).join('\n');
    }

    return reply;
  } catch (error) {
    logger.error('Erro na pesquisa de jurisprudência', {
      status: error.response?.status,
      data: error.response?.data,
    });
    throw new Error('Não foi possível pesquisar jurisprudência. Tente novamente.');
  }
}

/**
 * Pesquisa direta na API do STJ
 * Endpoint público de consulta de jurisprudência
 */
async function searchSTJ(termo) {
  try {
    const response = await axios.get('https://scon.stj.jus.br/SCON/pesquisar.jsp', {
      params: {
        livre: termo,
        b: 'ACOR', // acórdãos
        tp: 'T',   // tipo
        thesaurus: 'JURIDICO',
        p: true,
      },
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AVSN-Bot/1.0)',
      },
    });
    // A API do STJ retorna HTML, parsing básico
    return response.data;
  } catch (error) {
    logger.warn('Erro ao consultar STJ diretamente', { error: error.message });
    return null;
  }
}

/**
 * Pesquisa direta na API do STF
 */
async function searchSTF(termo) {
  try {
    const response = await axios.get('https://jurisprudencia.stf.jus.br/api/search/acervo', {
      params: {
        q: termo,
        page: 1,
        pageSize: 5,
      },
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AVSN-Bot/1.0)',
        'Accept': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    logger.warn('Erro ao consultar STF diretamente', { error: error.message });
    return null;
  }
}

module.exports = { searchJurisprudencia, searchSTJ, searchSTF };
