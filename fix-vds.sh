#!/bin/bash

echo "🚀 Исправление проблем с Docker на VDS..."

# Остановка всех контейнеров
echo "🛑 Остановка всех контейнеров..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Очистка старых данных
echo "🧹 Очистка старых томов и данных..."
docker system prune -f --volumes

# Настройка прав доступа
echo "🔐 Настройка прав доступа..."
chmod +x setup-permissions.sh
./setup-permissions.sh

# Показ .env файла
echo "📋 Проверка переменных окружения:"
if [ -f .env ]; then
    echo "✅ Файл .env найден:"
    cat .env
else
    echo "❌ Файл .env НЕ НАЙДЕН! Создаем..."
    cat > .env << 'EOF'
# MongoDB credentials - make sure they match in all services
MONGO_INITDB_ROOT_USERNAME=root
MONGO_INITDB_ROOT_PASSWORD=example
MONGODB_URI=mongodb://root:example@mongo_db:27017/vetg?authSource=admin

# Mongo Express credentials
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=pass
EOF
    echo "✅ Файл .env создан"
fi

echo ""
echo "🏗️ Пересборка образов..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo ""
echo "🚀 Запуск с обновленной конфигурацией..."
docker-compose -f docker-compose.prod.yml --env-file .env up -d

echo ""
echo "⏳ Ожидание запуска контейнеров (10 секунд)..."
sleep 10

echo ""
echo "📊 Проверка статуса контейнеров:"
docker ps -a

echo ""
echo "📋 Логи MongoDB:"
docker logs mongo_db_prod --tail=20

echo ""
echo "📋 Логи Parser2:"
docker logs vparser-parser2-1 --tail=20

echo ""
echo "✅ Готово! Проверьте статус выше." 