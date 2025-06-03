#!/bin/bash
set -e

echo "[INIT] =========================================="
echo "[INIT] 🚀 Запуск парсера с D-Bus поддержкой"
echo "[INIT] OS: $(uname -a)"
echo "[INIT] User: $(whoami)"
echo "[INIT] UID: $(id -u)"
echo "[INIT] Node.js: $(node --version)"
echo "[INIT] =========================================="

# Глобальные переменные для отслеживания процессов
XVFB_PID=""
DBUS_SYSTEM_PID=""
DBUS_SESSION_PID=""
UPOWERD_PID=""

# Функция для корректной очистки ресурсов
cleanup_resources() {
    log "🧹 Запуск процедуры очистки ресурсов..."
    
    # Завершаем Xvfb
    if [ -n "$XVFB_PID" ] && kill -0 "$XVFB_PID" 2>/dev/null; then
        log "🖥️ Завершение Xvfb (PID: $XVFB_PID)..."
        kill -TERM "$XVFB_PID" 2>/dev/null || true
        sleep 2
        kill -KILL "$XVFB_PID" 2>/dev/null || true
    fi
    
    # Очищаем X11 lock файлы
    sudo rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true
    
    # Завершаем все Xvfb процессы
    pkill -f "Xvfb.*:99" 2>/dev/null || true
    
    # Завершаем UPower
    if pgrep upowerd > /dev/null; then
        log "🔋 Завершение UPower daemon..."
        sudo pkill -TERM upowerd 2>/dev/null || true
        sleep 2
        sudo pkill -KILL upowerd 2>/dev/null || true
    fi
    
    # Завершаем D-Bus процессы
    log "🔌 Завершение D-Bus процессов..."
    pkill -f "dbus-daemon.*session" 2>/dev/null || true
    sudo pkill -f "dbus-daemon.*system" 2>/dev/null || true
    
    # Очищаем D-Bus файлы
    sudo rm -f /run/dbus/pid /var/run/dbus/pid 2>/dev/null || true
    sudo rm -f /var/run/dbus/system_bus_socket 2>/dev/null || true
    sudo rm -f /run/user/1000/bus 2>/dev/null || true
    
    log "✅ Очистка ресурсов завершена"
}

# Обработчик сигналов для graceful shutdown
signal_handler() {
    log "⚠️ Получен сигнал завершения. Выполняем корректную очистку..."
    cleanup_resources
    log "🏁 Скрипт завершен с очисткой ресурсов"
    exit 0
}

# Устанавливаем обработчики сигналов
trap signal_handler SIGTERM SIGINT EXIT

# Функция для логирования
log() {
    echo "[$(date '+%H:%M:%S')] $1"
}

# Функция для проверки процесса
check_process() {
    local process_name="$1"
    if pgrep -x "$process_name" > /dev/null; then
        log "✅ $process_name запущен"
        return 0
    else
        log "❌ $process_name НЕ запущен"
        return 1
    fi
}

# Функция для проверки D-Bus соединения
test_dbus_connection() {
    local bus_type="$1"
    local timeout=5
    
    if [ "$bus_type" = "system" ]; then
        if timeout $timeout dbus-send --system --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames > /dev/null 2>&1; then
            log "✅ D-Bus system соединение работает"
            return 0
        else
            log "❌ D-Bus system соединение НЕ работает"
            return 1
        fi
    elif [ "$bus_type" = "session" ]; then
        if timeout $timeout dbus-send --session --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames > /dev/null 2>&1; then
            log "✅ D-Bus session соединение работает"
            return 0
        else
            log "❌ D-Bus session соединение НЕ работает"
            return 1
        fi
    fi
}

# 1. Первичная очистка старых ресурсов
log "🧹 Полная очистка старых ресурсов..."
cleanup_resources

# 2. Настройка директорий D-Bus с правильными правами
log "📁 Настройка директорий D-Bus..."
sudo mkdir -p /var/run/dbus /run/dbus /run/user/1000
sudo chown messagebus:messagebus /var/run/dbus /run/dbus 2>/dev/null || true
sudo chown $(whoami):$(whoami) /run/user/1000
sudo chmod 755 /var/run/dbus /run/dbus
sudo chmod 700 /run/user/1000

# 3. Запуск system D-Bus с правильными параметрами
log "🔧 Запуск system D-Bus daemon..."
if ! check_process "dbus-daemon"; then
    sudo dbus-daemon --system --fork --nopidfile
    sleep 3
    
    if check_process "dbus-daemon"; then
        DBUS_SYSTEM_PID=$(pgrep -f "dbus-daemon.*system" | head -1)
        log "⏳ Тестирование system D-Bus соединения..."
        if test_dbus_connection "system"; then
            log "🎉 System D-Bus полностью готов!"
        else
            log "⚠️ System D-Bus запущен, но соединение не стабильно"
        fi
    else
        log "❌ Критическая ошибка: System D-Bus НЕ запустился!"
        exit 1
    fi
fi

# 4. Настройка переменных окружения ПЕРЕД запуском сессии
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
log "📁 XDG_RUNTIME_DIR: $XDG_RUNTIME_DIR"
log "🔌 DBUS_SESSION_BUS_ADDRESS: $DBUS_SESSION_BUS_ADDRESS"

# 5. Запуск D-Bus session с правильными параметрами
log "🔌 Запуск D-Bus session daemon..."
# Убиваем старые сессии
pkill -f "dbus-daemon.*session" 2>/dev/null || true
sleep 1

# Запускаем новую сессию
dbus-daemon --session --fork --nopidfile --address="$DBUS_SESSION_BUS_ADDRESS"
sleep 3
DBUS_SESSION_PID=$(pgrep -f "dbus-daemon.*session" | head -1)

log "⏳ Тестирование session D-Bus соединения..."
if test_dbus_connection "session"; then
    log "🎉 Session D-Bus полностью готов!"
else
    log "❌ Критическая ошибка: Session D-Bus соединение не работает!"
    exit 1
fi

# 6. КРИТИЧНО: Проверяем что оба D-Bus готовы перед UPower
log "🔍 Финальная проверка D-Bus готовности..."
system_ready=false
session_ready=false

if test_dbus_connection "system"; then
    system_ready=true
fi

if test_dbus_connection "session"; then
    session_ready=true
fi

if [ "$system_ready" = true ] && [ "$session_ready" = true ]; then
    log "✅ Оба D-Bus (system + session) готовы для UPower"
else
    log "❌ D-Bus НЕ готов: system=$system_ready, session=$session_ready"
    exit 1
fi

# 7. Запуск UPower с правильным окружением
log "🔋 Запуск UPower daemon с D-Bus поддержкой..."
if ! check_process "upowerd"; then
    # Находим правильный путь к upowerd
    UPOWERD_PATH=""
    for path in /usr/libexec/upowerd /usr/lib/upower/upowerd /usr/sbin/upowerd; do
        if [ -x "$path" ]; then
            UPOWERD_PATH="$path"
            break
        fi
    done
    
    if [ -n "$UPOWERD_PATH" ]; then
        log "📍 Найден UPower: $UPOWERD_PATH"
        
        # ИСПРАВЛЯЕМ D-Bus для UPower - правильная последовательность инициализации
        log "🔧 Настройка правильных D-Bus переменных для UPower..."
        
        # Ждем стабилизации D-Bus
        sleep 2
        
        # Проверяем что D-Bus system сокет действительно существует
        if [ ! -S "/var/run/dbus/system_bus_socket" ]; then
            log "❌ D-Bus system socket не найден!"
            exit 1
        fi
        
        # Запускаем UPower с минимальным окружением и правильным D-Bus
        sudo env -i \
            PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
            DBUS_SYSTEM_BUS_ADDRESS="unix:path=/var/run/dbus/system_bus_socket" \
            $UPOWERD_PATH --verbose 2>/tmp/upowerd.log &
        
        sleep 5
        UPOWERD_PID=$(pgrep upowerd | head -1)
        
        if check_process "upowerd"; then
            log "🎉 UPower успешно запущен!"
            
            # Проверяем лог на наличие критических ошибок
            if [ -f /tmp/upowerd.log ]; then
                critical_errors=$(grep -c "CRITICAL\|ERROR" /tmp/upowerd.log 2>/dev/null || echo "0")
                warnings=$(grep -c "WARNING" /tmp/upowerd.log 2>/dev/null || echo "0")
                
                # Убираем лишние символы из переменных
                critical_errors=$(echo "$critical_errors" | tr -d '\n\r ')
                warnings=$(echo "$warnings" | tr -d '\n\r ')
                
                if [ "$critical_errors" -gt 0 ] 2>/dev/null; then
                    log "⚠️ UPower имеет $critical_errors критических ошибок в логе"
                    log "📋 Первые ошибки:"
                    head -10 /tmp/upowerd.log | grep "CRITICAL\|ERROR" | head -3 || true
                else
                    log "✅ UPower запущен без критических ошибок"
                fi
                
                if [ "$warnings" -gt 0 ] 2>/dev/null; then
                    log "📝 UPower имеет $warnings предупреждений (это нормально для Docker)"
                fi
            fi
            
            # СТРОГОЕ тестирование D-Bus соединения UPower
            log "🔍 Строгое тестирование D-Bus соединения UPower..."
            
            if dbus-send --system --dest=org.freedesktop.UPower --type=method_call --print-reply /org/freedesktop/UPower org.freedesktop.UPower.EnumerateDevices > /dev/null 2>&1; then
                log "✅ UPower ПРАВИЛЬНО подключен к D-Bus system - проверка пройдена"
            else
                log "❌ КРИТИЧЕСКАЯ ОШИБКА: UPower НЕ может общаться с D-Bus!"
                log "📋 Дополнительная диагностика D-Bus..."
                
                # Показываем доступные D-Bus службы
                dbus-send --system --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames | grep -i upower || log "   UPower НЕ зарегистрирован в D-Bus"
                exit 1
            fi
        else
            log "❌ КРИТИЧЕСКАЯ ОШИБКА: UPower НЕ запустился!"
            if [ -f /tmp/upowerd.log ]; then
                log "📋 Последние строки лога UPower:"
                tail -10 /tmp/upowerd.log
            fi
            exit 1
        fi
    else
        log "❌ UPower исполняемый файл НЕ найден!"
        exit 1
    fi
fi

# 8. Настройка Xvfb для браузера
log "🖥️ Настройка виртуального дисплея Xvfb..."
export DISPLAY=:99

# Очищаем старые lock файлы для X11 дисплея :99
sudo rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true

# Запускаем Xvfb с правильными параметрами
Xvfb :99 -screen 0 1280x1024x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!
sleep 3

if pgrep -x "Xvfb" > /dev/null; then
    log "✅ Xvfb запущен на дисплее :99 (PID: $XVFB_PID)"
else
    log "❌ Ошибка запуска Xvfb"
    exit 1
fi

# 9. Финальная диагностика системы
log "🔍 Финальная диагностика системы..."
log "⚡ Активные процессы:"
ps aux | grep -E "(dbus|upower|Xvfb)" | grep -v grep || log "   Нет процессов dbus/upower/Xvfb"

log "🔌 D-Bus сокеты:"
ls -la /var/run/dbus/ 2>/dev/null || log "   /var/run/dbus/ пуст"
ls -la /run/user/1000/ 2>/dev/null || log "   /run/user/1000/ пуст"

log "🌍 Переменные окружения:"
env | grep -E "(DISPLAY|DBUS|XDG)" || log "   Переменные не найдены"

# 10. Окончательная готовность - запускаем Node.js приложение
log "🚀 Система готова! Запускаем Node.js парсер..."
log "==============================================="

# Убеждаемся что мы в правильной директории
cd "$(dirname "$0")"

# Запускаем главное приложение
exec node scraper.js 