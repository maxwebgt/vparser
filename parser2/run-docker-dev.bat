@echo off
REM Скрипт для сборки и запуска parser2 в Docker (dev-режим)

cd /d %~dp0

REM Сборка образа
call docker-compose -f ..\docker-compose.dev.yml build parser2

REM Запуск контейнера
call docker-compose -f ..\docker-compose.dev.yml up -d parser2

REM Просмотр логов
call docker-compose -f ..\docker-compose.dev.yml logs -f parser2 