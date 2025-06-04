@echo off
echo ===============================================
echo ⚡ Быстрый деплой VSEM (с кэшированием)
echo ===============================================
echo 🔧 Исправления в этой версии (Оптимизированная):
echo  - ✅ Фикс startTime is not defined
echo  - ✅ Убран проблемный скроллинг
echo  - ✅ Оптимизация: прямой переход на товар
echo  - ✅ Удалены: главная, город, куки
echo  - ✅ Сохранены антибот механизмы
echo ===============================================
set DOCKER_BUILDKIT=1
echo 🛑 Остановка контейнеров...
docker-compose -f docker-compose.prod.yml down
echo 🔨 Сборка с кэшированием...
docker-compose -f docker-compose.prod.yml build --no-cache
echo 🚀 Запуск приложения...
docker-compose -f docker-compose.prod.yml up -d
echo ===============================================
echo ✅ Готово! Приложение: http://localhost
echo 📋 Просмотр логов: docker-compose -f docker-compose.prod.yml logs -f app
echo ===============================================
