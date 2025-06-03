#!/bin/bash

echo "🔍 === ЕДИНСТВЕННАЯ ДИАГНОСТИКА VDS ==="

# Бэкап оригинального start-parser.sh
cp parser2/start-parser.sh parser2/start-parser.sh.backup 2>/dev/null

# Создаем диагностический start-parser.sh
cat > parser2/start-parser.sh << 'EOF'
#!/bin/bash

echo "🔍 === VDS ДИАГНОСТИКА ==="
echo "Platform: $(uname -a)"
echo "Environment: $NODE_ENV"

cd /app

# Запуск диагностики
node scraper.js --limit 1

echo "🔍 === ДИАГНОСТИКА ЗАВЕРШЕНА ==="
EOF

chmod +x parser2/start-parser.sh

echo "🏗️ Пересборка и запуск..."
docker-compose -f docker-compose.prod.yml down parser2 2>/dev/null
docker-compose -f docker-compose.prod.yml build parser2
docker-compose -f docker-compose.prod.yml up parser2 --abort-on-container-exit

echo ""
echo "🔄 Восстанавливаем оригинальный start-parser.sh..."
cp parser2/start-parser.sh.backup parser2/start-parser.sh 2>/dev/null

echo "✅ ГОТОВО! Смотри логи выше" 