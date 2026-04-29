#!/bin/bash
# ============================================
# AVSN WhatsApp Bot — Setup Rápido
# ============================================
# Execute na VPS: bash setup.sh
# Pré-requisito: Docker e Docker Compose instalados

set -e

echo "=========================================="
echo "  AVSN WhatsApp Bot — Setup"
echo "=========================================="

# 1. Copia .env se não existir
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "📝 Arquivo .env criado. Edite antes de continuar:"
  echo "   nano .env"
  echo ""
  echo "Preencha pelo menos:"
  echo "  - EVOLUTION_API_KEY (invente uma chave segura, ex: $(openssl rand -hex 16))"
  echo "  - PERPLEXITY_API_KEY (obtenha em https://www.perplexity.ai/settings/api)"
  echo "  - AUTHORIZED_NUMBERS (seu número com DDI+DDD, ex: 5511999998888)"
  echo ""
  echo "Depois, execute novamente: bash setup.sh"
  exit 0
fi

# 2. Sobe os containers
echo "🐳 Subindo containers..."
docker compose up -d --build

echo ""
echo "⏳ Aguardando Evolution API iniciar..."
sleep 10

# 3. Lê variáveis do .env
source .env

# 4. Cria instância na Evolution API
echo "📱 Criando instância do WhatsApp..."
curl -s -X POST "${EVOLUTION_API_URL:-http://localhost:8080}/instance/create" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"instanceName\": \"${EVOLUTION_INSTANCE:-avsn-bot}\",
    \"integration\": \"WHATSAPP-BAILEYS\",
    \"qrcode\": true
  }" | head -c 500
echo ""

# 5. Configura webhook
echo ""
echo "🔗 Configurando webhook..."
curl -s -X POST "${EVOLUTION_API_URL:-http://localhost:8080}/webhook/set/${EVOLUTION_INSTANCE:-avsn-bot}" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"webhook\": {
      \"enabled\": true,
      \"url\": \"http://bot:${BOT_PORT:-3000}${BOT_WEBHOOK_PATH:-/webhook/evolution}\",
      \"webhookByEvents\": true,
      \"events\": [\"MESSAGES_UPSERT\"]
    }
  }" | head -c 500
echo ""

# 6. Mostra QR Code
echo ""
echo "=========================================="
echo "  📲 ESCANEIE O QR CODE"
echo "=========================================="
echo ""
echo "Abra no navegador:"
echo "  http://$(hostname -I | awk '{print $1}'):8080/manager"
echo ""
echo "Ou via API:"
echo "  curl -s http://localhost:8080/instance/connect/${EVOLUTION_INSTANCE:-avsn-bot} -H 'apikey: $EVOLUTION_API_KEY'"
echo ""
echo "Após escanear o QR Code com o WhatsApp do escritório,"
echo "envie uma mensagem de teste para o número conectado."
echo ""
echo "✅ Setup concluído!"
