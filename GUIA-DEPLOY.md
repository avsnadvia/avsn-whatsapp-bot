# AVSN WhatsApp Bot — Guia de Deploy

## O que é

Bot para WhatsApp que pesquisa informações na internet usando IA (Perplexity), com foco em operações policiais, investigados, tipos penais e notícias jurídicas. Uso interno do escritório.

## Stack

- **Evolution API** — conexão com WhatsApp (open-source, brasileiro)
- **Perplexity API** — busca na internet com IA (modelo sonar-pro)
- **Node.js + Express** — webhook que recebe mensagens e responde
- **Docker Compose** — sobe tudo com um comando

## Pré-requisitos

1. **VPS com Docker** — qualquer VPS Ubuntu 22+ com Docker instalado (~$5-10/mês na Hetzner ou DigitalOcean)
2. **Chave da Perplexity** — crie em https://www.perplexity.ai/settings/api (plano Pro ~$5/1000 buscas)
3. **Número de WhatsApp** — um chip/número dedicado para o bot (pode ser um número secundário do escritório)

## Deploy em 5 minutos

```bash
# 1. Na VPS, clone ou copie a pasta do projeto
scp -r avsn-whatsapp-bot/ usuario@sua-vps:/opt/

# 2. Acesse a VPS
ssh usuario@sua-vps
cd /opt/avsn-whatsapp-bot

# 3. Instale Docker (se ainda não tiver)
curl -fsSL https://get.docker.com | sh

# 4. Execute o setup
bash setup.sh
# Na primeira execução, ele cria o .env — edite e rode novamente

# 5. Edite o .env
nano .env
# Preencha EVOLUTION_API_KEY, PERPLEXITY_API_KEY e AUTHORIZED_NUMBERS

# 6. Execute o setup novamente
bash setup.sh
```

## Conectando o WhatsApp

Após o setup, acesse o painel da Evolution API no navegador:

```
http://IP-DA-VPS:8080/manager
```

Escaneie o QR Code com o WhatsApp do número dedicado ao bot (como no WhatsApp Web).

## Usando

Basta enviar uma mensagem para o número do bot:

- `O que se sabe sobre a Operação Lava Jato?`
- `Quem são os investigados na Operação XYZ?`
- `STJ prisão preventiva crimes econômicos jurisprudência recente`
- `/ajuda` — mostra comandos disponíveis

O bot reage com 🔍 enquanto pesquisa e ✅ quando termina.

## Adicionando novos módulos

A arquitetura é modular. Para adicionar um novo comando/funcionalidade:

1. Crie um novo service em `src/services/` (ex: `jurisprudencia.js`)
2. Crie um handler em `src/handlers/` ou adicione ao `message.js`
3. Registre o comando no objeto `COMMANDS` em `src/handlers/message.js`

### Ideias para expansão

- **Pesquisa de jurisprudência** — integrar com API do STJ/STF ou JusBrasil
- **Monitor de publicações** — verificar DJe/DOU periodicamente e alertar
- **Análise de documentos** — enviar PDF pelo WhatsApp e receber análise
- **Cálculo de pena** — informar dados e receber cálculo de progressão

## Custos estimados

| Item | Custo mensal |
|------|-------------|
| VPS (Hetzner CX22) | ~€4/mês |
| Perplexity API (uso moderado) | ~$20-50/mês |
| **Total** | **~R$ 150-300/mês** |

## Troubleshooting

```bash
# Ver logs do bot
docker compose logs -f bot

# Ver logs da Evolution API
docker compose logs -f evolution

# Reiniciar tudo
docker compose restart

# Reconectar WhatsApp (novo QR Code)
curl -X DELETE http://localhost:8080/instance/logout/avsn-bot -H "apikey: SUA_KEY"
curl -X GET http://localhost:8080/instance/connect/avsn-bot -H "apikey: SUA_KEY"
```
