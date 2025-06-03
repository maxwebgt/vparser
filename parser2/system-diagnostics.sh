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
    esac
    ((TOTAL_CHECKS++))
}

add_recommendation() {
    RECOMMENDATIONS+=("$1")
}

check_system_info() {
    log "HEADER" "СИСТЕМНАЯ ИНФОРМАЦИЯ"
    
    log "INFO" "ОС: $(uname -a)"
    
    if [ -f /etc/os-release ]; then
        source /etc/os-release
        log "INFO" "Дистрибутив: ${PRETTY_NAME:-$ID}"
    fi
    
    ARCH=$(uname -m)
    if [[ "$ARCH" == "x86_64" ]]; then
        log "SUCCESS" "Архитектура x86_64 - совместима с Chrome"
    else
        log "ERROR" "Архитектура $ARCH не совместима с Chrome"
    fi
}

check_system_resources() {
    log "HEADER" "РЕСУРСЫ СИСТЕМЫ"
    
    CPU_CORES=$(nproc)
    log "INFO" "CPU ядер: ${CPU_CORES}"
    
    if [ "$CPU_CORES" -ge 2 ]; then
        log "SUCCESS" "Достаточно CPU ядер"
    else
        log "WARNING" "Мало CPU ядер"
    fi
    
    MEM_TOTAL_MB=$(free -m | awk 'NR==2{print $2}')
    log "INFO" "Память: ${MEM_TOTAL_MB}MB"
    
    if [ "$MEM_TOTAL_MB" -ge 2048 ]; then
        log "SUCCESS" "Достаточно памяти"
    elif [ "$MEM_TOTAL_MB" -ge 1024 ]; then
        log "WARNING" "Минимальная память"
        add_recommendation "Увеличьте память до 2GB+"
    else
        log "ERROR" "Недостаточно памяти"
        add_recommendation "Увеличьте память до минимум 1GB"
    fi
    
    TMP_FREE=$(df /tmp | awk 'NR==2 {print $4}')
    if [ "$TMP_FREE" -gt 1048576 ]; then
        log "SUCCESS" "Достаточно места в /tmp"
    else
        log "WARNING" "Мало места в /tmp"
    fi
}

check_networking() {
    log "HEADER" "СЕТЬ"
    
    if nslookup google.com >/dev/null 2>&1; then
        log "SUCCESS" "DNS работает"
    else
        log "ERROR" "DNS не работает"
    fi
    
    if nslookup vseinstrumenti.ru >/dev/null 2>&1; then
        log "SUCCESS" "Целевой сайт доступен"
    else
        log "ERROR" "Целевой сайт недоступен"
    fi
    
    if curl --connect-timeout 5 -s http://httpbin.org/ip >/dev/null 2>&1; then
        log "SUCCESS" "HTTP соединения работают"
    else
        log "WARNING" "Проблемы с HTTP"
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
    log "HEADER" "D-BUS"
    
    if command -v dbus-send >/dev/null 2>&1; then
        log "SUCCESS" "D-Bus установлен"
    else
        log "ERROR" "D-Bus не установлен"
        add_recommendation "Установите dbus: apt-get install dbus"
        return
    fi
    
    if systemctl is-active dbus >/dev/null 2>&1 || pgrep -f "dbus-daemon.*system" >/dev/null 2>&1; then
        log "SUCCESS" "System D-Bus запущен"
    else
        log "ERROR" "System D-Bus не запущен"
        add_recommendation "Запустите D-Bus: systemctl start dbus"
    fi
    
    if dbus-send --system --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames >/dev/null 2>&1; then
        log "SUCCESS" "D-Bus работает"
    else
        log "ERROR" "D-Bus не работает"
    fi
    
    if command -v upowerd >/dev/null 2>&1; then
        log "SUCCESS" "UPower установлен"
    else
        log "ERROR" "UPower не установлен"
        add_recommendation "Установите UPower: apt-get install upower"
    fi
}

check_x11() {
    log "HEADER" "X11/XVFB"
    
    if command -v Xvfb >/dev/null 2>&1; then
        log "SUCCESS" "Xvfb установлен"
    else
        log "ERROR" "Xvfb не установлен"
        add_recommendation "Установите Xvfb: apt-get install xvfb"
        return
    fi
    
    if Xvfb :99 -screen 0 1280x1024x24 &>/dev/null &
    then
        XVFB_PID=$!
        sleep 2
        if kill -0 $XVFB_PID 2>/dev/null; then
            log "SUCCESS" "Xvfb запускается"
            kill $XVFB_PID 2>/dev/null
            rm -f /tmp/.X99-lock 2>/dev/null
        else
            log "ERROR" "Xvfb не запускается"
        fi
    else
        log "ERROR" "Ошибка запуска Xvfb"
    fi
}

check_chrome() {
    log "HEADER" "CHROME"
    
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
            break
        fi
    done
    
    if [ "$CHROME_FOUND" = false ]; then
        log "ERROR" "Chrome не найден"
        add_recommendation "Установите Chrome"
        return
    fi
    
    if timeout 10 $chrome_path --headless --disable-gpu --no-sandbox --dump-dom about:blank >/dev/null 2>&1; then
        log "SUCCESS" "Chrome запускается в headless"
    else
        log "ERROR" "Chrome не запускается"
    fi
}

check_nodejs() {
    log "HEADER" "NODE.JS"
    
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        log "SUCCESS" "Node.js: $NODE_VERSION"
        
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -ge 18 ]; then
            log "SUCCESS" "Версия Node.js совместима"
        else
            log "WARNING" "Старая версия Node.js"
            add_recommendation "Обновите Node.js до 18+"
        fi
    else
        log "ERROR" "Node.js не установлен"
        add_recommendation "Установите Node.js"
    fi
}

check_mongodb() {
    log "HEADER" "MONGODB"
    
    MONGO_HOST=${MONGO_HOST:-"mongo_db"}
    MONGO_PORT=${MONGO_PORT:-"27017"}
    
    if timeout 5 bash -c "</dev/tcp/$MONGO_HOST/$MONGO_PORT" 2>/dev/null; then
        log "SUCCESS" "MongoDB доступен на $MONGO_HOST:$MONGO_PORT"
    else
        log "ERROR" "MongoDB недоступен"
    fi
}

generate_final_report() {
    log "HEADER" "ФИНАЛЬНЫЙ ОТЧЕТ"
    
    echo ""
    echo -e "${WHITE}📊 СТАТИСТИКА:${NC}"
    echo -e "${GREEN}✅ Пройдено: ${PASSED_CHECKS}${NC}"
    echo -e "${YELLOW}⚠️  Предупреждения: ${WARNING_CHECKS}${NC}"
    echo -e "${RED}❌ Ошибки: ${FAILED_CHECKS}${NC}"
    echo -e "${CYAN}📋 Всего: ${TOTAL_CHECKS}${NC}"
    
    if [ ${#CRITICAL_ISSUES[@]} -gt 0 ]; then
        echo ""
        echo -e "${RED}🔥 КРИТИЧНЫЕ ПРОБЛЕМЫ:${NC}"
        for issue in "${CRITICAL_ISSUES[@]}"; do
            echo -e "${RED}   • $issue${NC}"
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
        echo -e "${GREEN}🎉 СИСТЕМА ГОТОВА (${READINESS_SCORE}%)${NC}"
    elif [ $READINESS_SCORE -ge 70 ]; then
        echo -e "${YELLOW}⚠️  ЧАСТИЧНО ГОТОВА (${READINESS_SCORE}%)${NC}"
    else
        echo -e "${RED}❌ НЕ ГОТОВА (${READINESS_SCORE}%)${NC}"
    fi
}

main() {
    clear
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC} ${WHITE}🚀 ДИАГНОСТИКА СИСТЕМЫ ДЛЯ ПАРСЕРА${NC}                   ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [[ $EUID -eq 0 ]]; then
        log "INFO" "Запущено от root"
    else
        log "WARNING" "Запущено НЕ от root - некоторые проверки недоступны"
    fi
    
    check_system_info
    check_system_resources
    check_networking
    check_docker
    check_dbus
    check_x11
    check_chrome
    check_nodejs
    check_mongodb
    
    generate_final_report
}

if ! command -v bc >/dev/null 2>&1; then
    apt-get update && apt-get install -y bc 2>/dev/null || {
        echo "Не удалось установить 'bc'"
    }
fi

main "$@" 