#!/bin/bash

echo "🔧 Исправляем переменные окружения для пользователя $(whoami) (UID=$UID)"

# Удаляем неправильные переменные от root
unset XDG_RUNTIME_DIR
unset DBUS_SESSION_BUS_ADDRESS
unset DBUS_SYSTEM_BUS_ADDRESS

# Устанавливаем правильные переменные для текущего пользователя
export XDG_RUNTIME_DIR="/run/user/$UID"
export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$UID/bus"

echo "✅ Новые переменные:"
echo "   XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR"
echo "   DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS"

# Проверяем существование директории
if [ -d "$XDG_RUNTIME_DIR" ]; then
    echo "✅ Директория $XDG_RUNTIME_DIR существует"
    ls -la $XDG_RUNTIME_DIR/bus 2>/dev/null && echo "✅ D-Bus сокет найден" || echo "⚠️ D-Bus сокет не найден"
else
    echo "❌ Директория $XDG_RUNTIME_DIR НЕ существует"
    echo "🔧 Создаём временную директорию..."
    export XDG_RUNTIME_DIR="/tmp/runtime-$UID"
    mkdir -p $XDG_RUNTIME_DIR
    chmod 700 $XDG_RUNTIME_DIR
    # Отключаем D-Bus если нет правильной директории
    unset DBUS_SESSION_BUS_ADDRESS
    echo "✅ Создана временная директория: $XDG_RUNTIME_DIR"
    echo "⚠️ D-Bus отключён"
fi

echo ""
echo "🚀 Теперь можно запускать скрипты:"
echo "   node scraper.js"
echo "   node debug-scraper.js"
echo "   node simple-test.js" 