#!/bin/bash

echo "🔍 === БЫСТРАЯ ДИАГНОСТИКА VDS ==="

# Остановка текущего парсера
echo "🛑 Остановка текущего парсера..."
docker stop vparser-parser2-1 2>/dev/null || true

# Запуск парсера с диагностическими логами
echo "🚀 Запуск диагностики..."
docker run --rm \
  -v $(pwd)/parser2:/app \
  -w /app \
  --user 1000:1000 \
  -e NODE_ENV=production \
  vparser-parser2 \
  node scraper.js --show-browser --limit 1

echo ""
echo "📋 === АНАЛИЗ ЗАВЕРШЕН ==="
echo "Если видите HTTP 403 или редирект на главную - это детекция VDS"
echo "Если работает нормально - проблема в другом" 