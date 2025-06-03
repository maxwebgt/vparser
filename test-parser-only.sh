#!/bin/bash

echo "🧪 Быстрое тестирование только парсера..."

# Остановка парсера
echo "🛑 Остановка парсера..."
docker stop vparser-parser2-1 2>/dev/null || true
docker rm vparser-parser2-1 2>/dev/null || true

# Настройка прав
echo "🔐 Быстрая настройка прав для parser2..."
mkdir -p ./parser2/logs ./parser2/data
chmod 755 ./parser2/logs ./parser2/data
sudo chown -R 1000:1000 ./parser2/logs ./parser2/data || chown -R 1000:1000 ./parser2/logs ./parser2/data

echo "📊 Проверка прав:"
ls -la ./parser2/logs
ls -la ./parser2/data

# Пересборка только парсера
echo "🏗️ Пересборка парсера..."
docker-compose -f docker-compose.prod.yml build --no-cache parser2

# Запуск только парсера (MongoDB должен быть уже запущен)
echo "🚀 Запуск парсера..."
docker-compose -f docker-compose.prod.yml up -d parser2

echo ""
echo "⏳ Ожидание 5 секунд..."
sleep 5

echo ""
echo "📋 Логи парсера:"
docker logs vparser-parser2-1 --tail=30

echo ""
echo "✅ Готово!" 