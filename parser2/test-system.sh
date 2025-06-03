#!/usr/bin/env bash

# Быстрое тестирование системы

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║${NC} ${WHITE}🚀 ТЕСТИРОВАНИЕ СИСТЕМЫ ДЛЯ ПАРСЕРА${NC}                     ${PURPLE}║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

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
            ;;
        "ERROR")
            echo -e "${CYAN}[${timestamp}]${NC} ${RED}❌ ${message}${NC}"
            ;;
    esac
}

run_local_test() {
    log "INFO" "🖥️ Тестирование локальной системы..."
    echo ""
    
    if [ -f "system-diagnostics.sh" ]; then
        bash system-diagnostics.sh
    else
        log "ERROR" "Файл system-diagnostics.sh не найден"
        return 1
    fi
}

run_docker_test() {
    log "INFO" "🐳 Тестирование в Docker..."
    echo ""
    
    # Проверяем Docker
    if ! command -v docker >/dev/null 2>&1; then
        log "ERROR" "Docker не установлен"
        return 1
    fi
    
    if ! docker ps >/dev/null 2>&1; then
        log "ERROR" "Docker недоступен"
        return 1
    fi
    
    # Собираем образ
    log "INFO" "Сборка Docker образа..."
    if docker build -f Dockerfile.diagnostics \
        --build-arg BASE_IMAGE="debian:12-slim" \
        -t system-test \
        --quiet \
        . >/dev/null 2>&1; then
        log "SUCCESS" "Образ собран"
    else
        log "ERROR" "Ошибка сборки образа"
        return 1
    fi
    
    # Запускаем тест
    log "INFO" "Запуск теста в контейнере..."
    echo ""
    echo -e "${BLUE}════ DOCKER РЕЗУЛЬТАТ ═══${NC}"
    
    docker run --rm \
        --privileged \
        -v /sys:/sys:ro \
        -v /proc:/proc:ro \
        -e MONGO_HOST=host.docker.internal \
        system-test
    
    echo -e "${BLUE}════ КОНЕЦ DOCKER РЕЗУЛЬТАТА ═══${NC}"
}

show_menu() {
    echo -e "${YELLOW}📋 Выберите тип тестирования:${NC}"
    echo "1) 🖥️  Локальная система"
    echo "2) 🐳 Docker контейнер"
    echo "3) 🔄 Оба варианта"
    echo "4) ❌ Выход"
    echo ""
    read -p "Ваш выбор (1-4): " choice
    
    case $choice in
        1)
            run_local_test
            ;;
        2)
            run_docker_test
            ;;
        3)
            log "INFO" "🔄 Запускаем оба теста..."
            echo ""
            echo -e "${PURPLE}═══════════════ ЛОКАЛЬНЫЙ ТЕСТ ═══════════════${NC}"
            run_local_test
            echo ""
            echo -e "${PURPLE}════════════════ DOCKER ТЕСТ ════════════════${NC}"
            run_docker_test
            ;;
        4)
            log "INFO" "Выход"
            exit 0
            ;;
        *)
            log "ERROR" "Неверный выбор"
            show_menu
            ;;
    esac
}

# Если запущено с аргументом - автоматический режим
if [ $# -gt 0 ]; then
    case $1 in
        "local")
            run_local_test
            ;;
        "docker")
            run_docker_test
            ;;
        "both")
            run_local_test
            echo ""
            run_docker_test
            ;;
        *)
            echo "Использование: $0 [local|docker|both]"
            exit 1
            ;;
    esac
else
    # Интерактивный режим
    show_menu
fi 