const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

/**
 * Gera versículo bíblico curto para envio diário
 */

const BIBLIA_PROMPT = `Responda APENAS com um versículo bíblico curto no formato exato abaixo. Nada mais.

Formato:
"[frase do versículo]" [Livro] [capítulo]:[versículo]

Exemplos:
"Porque para Deus nada será impossível." Lucas 1:37
"O Senhor é o meu pastor; nada me faltará." Salmos 23:1
"Tudo posso naquele que me fortalece." Filipenses 4:13

Regras:
- Apenas UMA frase curta (máximo 2 linhas)
- Versão Almeida ou NVI
- Sem reflexão, sem comentário, sem emoji, sem título
- Varie bastante: Salmos, Provérbios, Isaías, Jeremias, Mateus, João, Romanos, Filipenses, Hebreus, Tiago, etc.
- Não repita versículos muito batidos. Explore a Bíblia toda.`;

async function gerarMensagemBiblica() {
  try {
    const hoje = new Date();
    const seed = `${hoje.getFullYear()}-${hoje.getMonth()}-${hoje.getDate()}`;

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: config.perplexity.model,
        messages: [
          { role: 'system', content: BIBLIA_PROMPT },
          { role: 'user', content: `Versículo do dia (seed: ${seed}).` },
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
    logger.error('Erro ao gerar versículo bíblico', { error: error.message });
    return getFallback();
  }
}

function getFallback() {
  const versiculos = [
    '"Porque para Deus nada será impossível." Lucas 1:37',
    '"O Senhor é o meu pastor; nada me faltará." Salmos 23:1',
    '"Tudo posso naquele que me fortalece." Filipenses 4:13',
    '"Entrega o teu caminho ao Senhor, confia nele, e o mais ele fará." Salmos 37:5',
    '"Não temas, porque eu sou contigo." Isaías 41:10',
    '"O amor é paciente, o amor é bondoso." 1 Coríntios 13:4',
    '"Buscai primeiro o Reino de Deus, e a sua justiça." Mateus 6:33',
    '"Sede fortes e corajosos. Não temais." Deuteronômio 31:6',
    '"A fé é a certeza daquilo que esperamos." Hebreus 11:1',
    '"Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia." Salmos 46:1',
    '"Alegrem-se na esperança, sejam pacientes na tribulação, perseverem na oração." Romanos 12:12',
    '"Lança o teu pão sobre as águas, porque depois de muitos dias o acharás." Eclesiastes 11:1',
    '"Bem-aventurados os misericordiosos, porque alcançarão misericórdia." Mateus 5:7',
    '"Em todo o tempo ama o amigo, e na angústia se faz o irmão." Provérbios 17:17',
    '"Sabemos que todas as coisas cooperam para o bem daqueles que amam a Deus." Romanos 8:28',
    '"Confia no Senhor de todo o teu coração." Provérbios 3:5',
    '"A esperança não nos decepciona." Romanos 5:5',
    '"Eu sou o caminho, a verdade e a vida." João 14:6',
    '"Os que esperam no Senhor renovam as suas forças." Isaías 40:31',
    '"Deus não nos deu espírito de covardia, mas de poder, de amor e de equilíbrio." 2 Timóteo 1:7',
    '"O choro pode durar uma noite, mas a alegria vem pela manhã." Salmos 30:5',
    '"Vinde a mim, todos os que estais cansados e sobrecarregados, e eu vos aliviarei." Mateus 11:28',
    '"Aquele que começou a boa obra em vós há de completá-la até o dia de Cristo Jesus." Filipenses 1:6',
    '"A tua palavra é lâmpada para os meus pés e luz para o meu caminho." Salmos 119:105',
    '"Tudo tem o seu tempo determinado, e há tempo para todo propósito debaixo do céu." Eclesiastes 3:1',
    '"Não andeis ansiosos por coisa alguma." Filipenses 4:6',
    '"O Senhor é bom; o seu amor dura para sempre." Salmos 100:5',
    '"Ainda que eu ande pelo vale da sombra da morte, não temerei mal nenhum, porque tu estás comigo." Salmos 23:4',
    '"Grandes coisas fez o Senhor por nós, e por isso estamos alegres." Salmos 126:3',
    '"Porque eu bem sei os planos que tenho para vós, diz o Senhor; planos de paz, e não de mal." Jeremias 29:11',
    '"A graça do Senhor Jesus Cristo seja com todos vós." Apocalipse 22:21',
  ];
  const index = new Date().getDate() % versiculos.length;
  return versiculos[index];
}

module.exports = { gerarMensagemBiblica };
