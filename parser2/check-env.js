#!/usr/bin/env node

import fs from 'fs';

console.log('\n🔍 === ДИАГНОСТИКА ОКРУЖЕНИЯ ===\n');

// Информация о системе
console.log('📊 Система:');
console.log(`  Платформа: ${process.platform}`);
console.log(`  Node.js: ${process.version}`);
console.log(`  UID: ${process.getuid ? process.getuid() : 'N/A'}`);
console.log(`  Пользователь: ${process.env.USER || process.env.USERNAME || 'unknown'}`);
console.log(`  Домашняя директория: ${process.env.HOME || 'unknown'}`);

// Критические переменные
console.log('\n🔑 Критические переменные:');
const xdgRuntime = process.env.XDG_RUNTIME_DIR;
const dbusSession = process.env.DBUS_SESSION_BUS_ADDRESS;

console.log(`  XDG_RUNTIME_DIR: ${xdgRuntime || 'НЕ УСТАНОВЛЕНА'}`);
console.log(`  DBUS_SESSION_BUS_ADDRESS: ${dbusSession || 'НЕ УСТАНОВЛЕНА'}`);

// Проверка соответствия
if (xdgRuntime && process.getuid) {
  const uid = process.getuid();
  const expectedDir = `/run/user/${uid}`;
  
  if (xdgRuntime === expectedDir) {
    console.log(`  ✅ XDG_RUNTIME_DIR правильная (соответствует UID ${uid})`);
  } else {
    console.log(`  ❌ XDG_RUNTIME_DIR НЕПРАВИЛЬНАЯ!`);
    console.log(`     Ожидается: ${expectedDir}`);
    console.log(`     Текущая: ${xdgRuntime}`);
    
    // Парсим UID из пути
    const match = xdgRuntime.match(/\/run\/user\/(\d+)/);
    if (match) {
      const pathUid = match[1];
      console.log(`     ⚠️ Путь указывает на UID ${pathUid}, а процесс запущен от UID ${uid}`);
    }
  }
}

// Проверка файловой системы
console.log('\n📁 Проверка файловой системы:');

if (xdgRuntime) {
  try {
    const stats = fs.statSync(xdgRuntime);
    console.log(`  Директория ${xdgRuntime}:`);
    console.log(`    Существует: ✅`);
    console.log(`    Владелец UID: ${stats.uid}`);
    console.log(`    Права: ${(stats.mode & parseInt('777', 8)).toString(8)}`);
    
    // Проверяем D-Bus сокет
    const dbusPath = `${xdgRuntime}/bus`;
    try {
      const busStats = fs.statSync(dbusPath);
      console.log(`  D-Bus сокет ${dbusPath}:`);
      console.log(`    Существует: ✅`);
      console.log(`    Тип: ${busStats.isSocket() ? 'сокет' : 'НЕ сокет!'}`);
    } catch (e) {
      console.log(`  D-Bus сокет ${dbusPath}: ❌ НЕ НАЙДЕН`);
    }
  } catch (e) {
    console.log(`  Директория ${xdgRuntime}: ❌ НЕ СУЩЕСТВУЕТ или НЕТ ДОСТУПА`);
    console.log(`    Ошибка: ${e.message}`);
  }
}

// Рекомендации
console.log('\n💡 РЕКОМЕНДАЦИИ:');

if (xdgRuntime && xdgRuntime.includes('/run/user/0') && process.getuid && process.getuid() !== 0) {
  console.log('  ❌ КРИТИЧЕСКАЯ ОШИБКА: Вы используете переменные окружения от root!');
  console.log('  🔧 Решение:');
  console.log('     1. chmod +x fix-env.sh');
  console.log('     2. source fix-env.sh');
  console.log('     3. node scraper.js');
  console.log('\n  ИЛИ используйте обёртку:');
  console.log('     1. chmod +x run-with-fix.sh');
  console.log('     2. ./run-with-fix.sh node scraper.js');
} else if (!xdgRuntime) {
  console.log('  ⚠️ XDG_RUNTIME_DIR не установлена');
  console.log('  🔧 Это может быть нормально, но лучше установить правильную.');
} else {
  console.log('  ✅ Окружение выглядит корректным');
}

console.log('\n'); 