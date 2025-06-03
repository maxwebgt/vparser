#!/bin/bash

echo "🔍 Запуск полного анализа детекции на VDS..."

# Остановка парсера если работает
docker stop vparser-parser2-1 2>/dev/null

# Быстрая пересборка образа с новым скриптом
echo "🏗️ Пересборка образа с диагностическим скриптом..."
docker-compose -f docker-compose.prod.yml build --no-cache parser2

# Создаем временный docker-compose только для диагностики
cat > docker-compose.debug.yml << 'EOF'
version: '3.8'
services:
  debug-parser:
    build:
      context: ./parser2
      dockerfile: Dockerfile
    container_name: debug-parser
    volumes:
      - ./parser2:/app
    working_dir: /app
    command: node scraper.js --show-browser --limit 1
    environment:
      - NODE_ENV=production
    user: "1000:1000"
EOF

echo "🚀 Запуск диагностического контейнера..."
docker-compose -f docker-compose.debug.yml up --build debug-parser

echo ""
echo "📋 Анализ завершен! Проверьте логи выше на предмет подозрительных признаков."
echo "Ищите секции:"
echo "  🚨 === КРИТИЧЕСКАЯ ДИАГНОСТИКА ==="
echo "  🔍 === ОТПЕЧАТОК БРАУЗЕРА ==="
echo "  📋 === АНАЛИЗ HTTP ЗАПРОСОВ ==="

# Очистка
docker-compose -f docker-compose.debug.yml down 2>/dev/null
rm -f docker-compose.debug.yml 