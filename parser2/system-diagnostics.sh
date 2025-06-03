#!/usr/bin/env bash

# Диагностика системы для парсера

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

TOTAL_CHECKS=0
PASSED_CHECKS=0
WARNING_CHECKS=0
FAILED_CHECKS=0
CRITICAL_ISSUES=()
WARNINGS=()
RECOMMENDATIONS=()

log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${CYAN}[${timestamp}]${NC} ${WHITE}ℹ️  ${message}${NC}"
            ;;
        "SUCCESS")
            echo -e "${CYAN}[${timestamp}]${NC} ${GREEN}✅ ${message}${NC}"
            ((PASSED_CHECKS++))
            ;;
        "WARNING")
            echo -e "${CYAN}[${timestamp}]${NC} ${YELLOW}⚠️  ${message}${NC}"
            WARNINGS+=("$message")
            ((WARNING_CHECKS++))
            ;;
        "ERROR")
            echo -e "${CYAN}[${timestamp}]${NC} ${RED}❌ ${message}${NC}"
            CRITICAL_ISSUES+=("$message")
            ((FAILED_CHECKS++))
            ;;
        "HEADER")
            echo ""
            echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
            echo -e "${WHITE}🔍 ${message}${NC}"
            echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
            ;;
        "SUBHEADER")
            echo ""
            echo -e "${BLUE}📋 ${message}${NC}"
            echo -e "${BLUE}────────────────────────────────────────────────────────────────${NC}"
            ;;
    esac
    ((TOTAL_CHECKS++))
}

add_recommendation() {
    RECOMMENDATIONS+=("$1")
}

check_system() {
    log "HEADER" "СИСТЕМА"
    
    log "INFO" "ОС: $(uname -s) $(uname -r)"
    
    if [ -f /etc/os-release ]; then
        source /etc/os-release
        log "INFO" "Дистрибутив: ${PRETTY_NAME:-$ID}"
    fi
    
    ARCH=$(uname -m)
    if [[ "$ARCH" == "x86_64" ]]; then
        log "SUCCESS" "Архитектура x86_64"
    else
        log "ERROR" "Архитектура $ARCH не поддерживается"
    fi
}

check_resources() {
    log "HEADER" "РЕСУРСЫ"
    
    CPU_CORES=$(nproc)
    log "INFO" "CPU: ${CPU_CORES} ядер"
    
    if [ "$CPU_CORES" -ge 2 ]; then
        log "SUCCESS" "Достаточно CPU ядер"
    else
        log "WARNING" "Мало CPU ядер"
    fi
    
    MEM_TOTAL_MB=$(free -m | awk 'NR==2{print $2}')
    log "INFO" "RAM: ${MEM_TOTAL_MB}MB"
    
    if [ "$MEM_TOTAL_MB" -ge 1024 ]; then
        log "SUCCESS" "Достаточно памяти"
    else
        log "ERROR" "Недостаточно памяти"
        add_recommendation "Увеличьте RAM до минимум 1GB"
    fi
    
    DISK_FREE=$(df / | awk 'NR==2 {print $4}')
    if [ "$DISK_FREE" -gt 1048576 ]; then
        log "SUCCESS" "Достаточно места на диске"
    else
        log "WARNING" "Мало места на диске"
    fi
}

check_network() {
    log "HEADER" "СЕТЬ"
    
    if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
        log "SUCCESS" "Интернет доступен"
    else
        log "ERROR" "Нет интернета"
    fi
    
    if nslookup google.com >/dev/null 2>&1; then
        log "SUCCESS" "DNS работает"
    else
        log "ERROR" "DNS не работает"
    fi
}

check_docker() {
    log "HEADER" "DOCKER"
    
    if command -v docker >/dev/null 2>&1; then
        log "SUCCESS" "Docker установлен"
        
        if docker ps >/dev/null 2>&1; then
            log "SUCCESS" "Docker доступен"
        else
            log "WARNING" "Docker требует sudo"
        fi
    else
        log "ERROR" "Docker не установлен"
        add_recommendation "Установите Docker"
    fi
}

check_dbus() {
    log "HEADER" "D-BUS СИСТЕМА"
    
    if command -v dbus-send >/dev/null 2>&1; then
        log "SUCCESS" "D-Bus утилиты установлены"
    else
        log "ERROR" "D-Bus утилиты не установлены"
        add_recommendation "Установите D-Bus: apt-get install dbus"
        return
    fi
    
    log "SUBHEADER" "System D-Bus"
    if systemctl is-active dbus >/dev/null 2>&1; then
        log "SUCCESS" "System D-Bus service активен"
    elif pgrep -f "dbus-daemon.*system" >/dev/null 2>&1; then
        log "SUCCESS" "System D-Bus daemon запущен"
    else
        log "ERROR" "System D-Bus не запущен"
        add_recommendation "Запустите system D-Bus: systemctl start dbus"
    fi
    
    if dbus-send --system --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames >/dev/null 2>&1; then
        log "SUCCESS" "System D-Bus соединение работает"
    else
        log "ERROR" "System D-Bus соединение не работает"
    fi
    
    log "SUBHEADER" "UPower (Power Management)"
    if command -v upowerd >/dev/null 2>&1; then
        log "SUCCESS" "UPower установлен"
        
        if pgrep upowerd >/dev/null 2>&1; then
            log "SUCCESS" "UPower daemon запущен"
        else
            log "WARNING" "UPower daemon не запущен"
        fi
    else
        log "ERROR" "UPower не установлен"
        add_recommendation "Установите UPower: apt-get install upower"
    fi
}

check_x11() {
    log "HEADER" "X11/XVFB"
    
    if command -v Xvfb >/dev/null 2>&1; then
        log "SUCCESS" "Xvfb установлен: $(which Xvfb)"
    else
        log "ERROR" "Xvfb не установлен"
        add_recommendation "Установите Xvfb: apt-get install xvfb"
        return
    fi
    
    log "SUBHEADER" "Тест Xvfb"
    if timeout 10 bash -c 'Xvfb :99 -screen 0 1280x1024x24 >/dev/null 2>&1 &
    XVFB_PID=$!
    sleep 2
    if kill -0 $XVFB_PID 2>/dev/null; then
        kill $XVFB_PID 2>/dev/null
        rm -f /tmp/.X99-lock 2>/dev/null
        exit 0
    else
        exit 1
    fi'; then
        log "SUCCESS" "Xvfb успешно запускается"
    else
        log "ERROR" "Xvfb не запускается"
    fi
}

check_chrome() {
    log "HEADER" "CHROME/BROWSER"
    
    CHROME_PATHS=(
        "/usr/bin/google-chrome-stable"
        "/usr/bin/google-chrome"
        "/usr/bin/chromium-browser"
        "/usr/bin/chromium"
    )
    
    CHROME_FOUND=false
    for chrome_path in "${CHROME_PATHS[@]}"; do
        if [ -x "$chrome_path" ]; then
            log "SUCCESS" "Chrome найден: $chrome_path"
            CHROME_FOUND=true
            
            CHROME_VERSION=$($chrome_path --version 2>/dev/null || echo "Неизвестно")
            log "INFO" "Версия: $CHROME_VERSION"
            break
        fi
    done
    
    if [ "$CHROME_FOUND" = false ]; then
        log "ERROR" "Chrome не найден"
        add_recommendation "Установите Chrome"
        return
    fi
    
    log "SUBHEADER" "Тест запуска Chrome"
    if timeout 10 $chrome_path --headless --disable-gpu --no-sandbox --disable-dev-shm-usage --dump-dom about:blank >/dev/null 2>&1; then
        log "SUCCESS" "Chrome запускается в headless режиме"
    else
        log "ERROR" "Chrome не запускается в headless режиме"
        add_recommendation "Проверьте зависимости Chrome"
    fi
}

check_nodejs() {
    log "HEADER" "NODE.JS ОКРУЖЕНИЕ"
    
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        log "SUCCESS" "Node.js установлен: $NODE_VERSION"
        
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -ge 18 ]; then
            log "SUCCESS" "Версия Node.js совместима с Puppeteer"
        else
            log "WARNING" "Старая версия Node.js (требуется 18+)"
            add_recommendation "Обновите Node.js до версии 18+"
        fi
    else
        log "ERROR" "Node.js не установлен"
        add_recommendation "Установите Node.js"
    fi
    
    if command -v npm >/dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        log "SUCCESS" "NPM установлен: $NPM_VERSION"
    else
        log "WARNING" "NPM не установлен"
    fi
}

check_mongodb() {
    log "HEADER" "MONGODB"
    
    MONGO_HOST=${MONGO_HOST:-"mongo_db"}
    MONGO_PORT=${MONGO_PORT:-"27017"}
    
    if timeout 3 bash -c "</dev/tcp/$MONGO_HOST/$MONGO_PORT" 2>/dev/null; then
        log "SUCCESS" "MongoDB доступен на $MONGO_HOST:$MONGO_PORT"
    else
        log "ERROR" "MongoDB недоступен"
        add_recommendation "Проверьте MongoDB или измените MONGO_HOST"
    fi
}

generate_final_report() {
    log "HEADER" "ФИНАЛЬНЫЙ ОТЧЕТ"
    
    echo ""
    echo -e "${WHITE}📊 СТАТИСТИКА ПРОВЕРОК:${NC}"
    echo -e "${GREEN}✅ Пройдено: ${PASSED_CHECKS}${NC}"
    echo -e "${YELLOW}⚠️  Предупреждения: ${WARNING_CHECKS}${NC}"
    echo -e "${RED}❌ Ошибки: ${FAILED_CHECKS}${NC}"
    echo -e "${CYAN}📋 Всего проверок: ${TOTAL_CHECKS}${NC}"
    
    if [ ${#CRITICAL_ISSUES[@]} -gt 0 ]; then
        echo ""
        echo -e "${RED}🔥 КРИТИЧНЫЕ ПРОБЛЕМЫ:${NC}"
        for issue in "${CRITICAL_ISSUES[@]}"; do
            echo -e "${RED}   • $issue${NC}"
        done
    fi
    
    if [ ${#WARNINGS[@]} -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  ПРЕДУПРЕЖДЕНИЯ:${NC}"
        for warning in "${WARNINGS[@]}"; do
            echo -e "${YELLOW}   • $warning${NC}"
        done
    fi
    
    if [ ${#RECOMMENDATIONS[@]} -gt 0 ]; then
        echo ""
        echo -e "${BLUE}💡 РЕКОМЕНДАЦИИ:${NC}"
        for recommendation in "${RECOMMENDATIONS[@]}"; do
            echo -e "${BLUE}   • $recommendation${NC}"
        done
    fi
    
    echo ""
    READINESS_SCORE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    
    if [ $READINESS_SCORE -ge 90 ]; then
        echo -e "${GREEN}🎉 СИСТЕМА ГОТОВА (${READINESS_SCORE}%): Можно запускать парсер!${NC}"
    elif [ $READINESS_SCORE -ge 70 ]; then
        echo -e "${YELLOW}⚠️  СИСТЕМА ЧАСТИЧНО ГОТОВА (${READINESS_SCORE}%): Рекомендуется устранить предупреждения${NC}"
    else
        echo -e "${RED}❌ СИСТЕМА НЕ ГОТОВА (${READINESS_SCORE}%): Необходимо исправить критичные проблемы${NC}"
    fi
    
    echo ""
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}🏁 Диагностика завершена в $(date)${NC}"
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
}

main() {
    clear
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC} ${WHITE}🚀 МОЩНАЯ ДИАГНОСТИКА СИСТЕМЫ ДЛЯ ПАРСЕРА${NC} ${PURPLE}║${NC}"
    echo -e "${PURPLE}║${NC} ${CYAN}Версия: 1.0 | Автор: AI Assistant${NC}                ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log "INFO" "🔍 Начинаем полную диагностику системы..."
    
    if [[ $EUID -eq 0 ]]; then
        log "INFO" "Запущено от root - все системные проверки доступны"
    else
        log "WARNING" "Запущено НЕ от root - некоторые проверки могут быть недоступны"
        add_recommendation "Запустите с sudo для полной диагностики: sudo $0"
    fi
    
    check_system
    check_resources
    check_network
    check_docker
    check_dbus
    check_x11
    check_chrome
    check_nodejs
    check_mongodb
    
    generate_final_report
}

# Проверяем bc без автоустановки - это НЕ критично
if ! command -v bc >/dev/null 2>&1; then
    echo "⚠️  bc не найден - некоторые математические вычисления могут не работать"
fi

main "$@" 