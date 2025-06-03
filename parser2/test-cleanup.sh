#!/bin/bash

echo "🧪 ТЕСТ: Запуск скрипта парсера с быстрым завершением для проверки очистки ресурсов"
echo "========================================================================"

echo "📊 Процессы ДО запуска:"
echo "Xvfb процессы:"
ps aux | grep -E "(Xvfb)" | grep -v grep || echo "  Нет Xvfb процессов"
echo "D-Bus процессы:"
ps aux | grep -E "(dbus)" | grep -v grep || echo "  Нет D-Bus процессов"
echo "UPower процессы:"
ps aux | grep -E "(upowerd)" | grep -v grep || echo "  Нет UPower процессов"

echo ""
echo "🚀 Запускаем скрипт парсера в фоне..."
bash ./start-parser.sh &
PARSER_PID=$!
echo "PID парсера: $PARSER_PID"

echo ""
echo "⏳ Ждем 15 секунд для инициализации..."
sleep 15

echo ""
echo "📊 Процессы ПОСЛЕ запуска:"
echo "Xvfb процессы:"
ps aux | grep -E "(Xvfb)" | grep -v grep || echo "  Нет Xvfb процессов"
echo "D-Bus процессы:"  
ps aux | grep -E "(dbus)" | grep -v grep || echo "  Нет D-Bus процессов"
echo "UPower процессы:"
ps aux | grep -E "(upowerd)" | grep -v grep || echo "  Нет UPower процессов"

echo ""
echo "📁 X11 lock файлы:"
ls -la /tmp/.X*lock 2>/dev/null || echo "  Нет lock файлов"

echo ""
echo "⚠️ Завершаем парсер через SIGTERM..."
kill -TERM $PARSER_PID

echo ""
echo "⏳ Ждем 10 секунд для корректного завершения..."
sleep 10

echo ""
echo "📊 Процессы ПОСЛЕ завершения:"
echo "Xvfb процессы:"
ps aux | grep -E "(Xvfb)" | grep -v grep || echo "  ✅ Нет Xvfb процессов (корректно очищено)"
echo "D-Bus процессы:"
ps aux | grep -E "(dbus)" | grep -v grep || echo "  ✅ Нет D-Bus процессов (корректно очищено)"
echo "UPower процессы:"
ps aux | grep -E "(upowerd)" | grep -v grep || echo "  ✅ Нет UPower процессов (корректно очищено)"

echo ""
echo "📁 X11 lock файлы ПОСЛЕ завершения:"
ls -la /tmp/.X*lock 2>/dev/null || echo "  ✅ Нет lock файлов (корректно очищено)"

echo ""
echo "🎯 РЕЗУЛЬТАТ ТЕСТА:"
XVFB_COUNT=$(ps aux | grep -E "(Xvfb)" | grep -v grep | wc -l)
DBUS_COUNT=$(ps aux | grep -E "(dbus)" | grep -v grep | wc -l)  
UPOWER_COUNT=$(ps aux | grep -E "(upowerd)" | grep -v grep | wc -l)
LOCK_COUNT=$(ls /tmp/.X*lock 2>/dev/null | wc -l)

if [ "$XVFB_COUNT" -eq 0 ] && [ "$DBUS_COUNT" -eq 0 ] && [ "$UPOWER_COUNT" -eq 0 ] && [ "$LOCK_COUNT" -eq 0 ]; then
    echo "✅ ТЕСТ ПРОЙДЕН: Все ресурсы корректно очищены!"
else
    echo "❌ ТЕСТ НЕ ПРОЙДЕН: Обнаружены неочищенные ресурсы:"
    echo "   Xvfb: $XVFB_COUNT, D-Bus: $DBUS_COUNT, UPower: $UPOWER_COUNT, Lock файлы: $LOCK_COUNT"
fi

echo ""
echo "🏁 Тест завершен." 