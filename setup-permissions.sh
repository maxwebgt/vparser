#!/bin/bash

echo "🔧 Настройка прав доступа для Docker контейнеров..."

# Получаем текущего пользователя
USER_ID=$(id -u)
GROUP_ID=$(id -g)

echo "📋 Пользователь: $USER (UID: $USER_ID, GID: $GROUP_ID)"

# Создаем директории если их нет
echo "📁 Создание необходимых директорий..."
mkdir -p ./docker/logs
mkdir -p ./parser2/logs  
mkdir -p ./parser2/data

# Устанавливаем правильные права
echo "🔐 Установка прав доступа..."

# Права для логов MongoDB (не используется, но на всякий случай)
chmod 755 ./docker/logs
chown -R $USER_ID:$GROUP_ID ./docker/logs

# Права для parser2
chmod 755 ./parser2/logs
chmod 755 ./parser2/data
chown -R $USER_ID:$GROUP_ID ./parser2/logs
chown -R $USER_ID:$GROUP_ID ./parser2/data

echo "✅ Права доступа настроены!"

# Проверяем результат
echo "📊 Проверка прав доступа:"
ls -la ./docker/logs 2>/dev/null || echo "   ./docker/logs - не создана"
ls -la ./parser2/logs 2>/dev/null || echo "   ./parser2/logs - не создана"  
ls -la ./parser2/data 2>/dev/null || echo "   ./parser2/data - не создана"

echo ""
echo "🚀 Теперь можно запускать: docker-compose -f docker-compose.prod.yml up -d" 