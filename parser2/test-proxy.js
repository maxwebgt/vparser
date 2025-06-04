#!/usr/bin/env node

import { ProxyHandler } from './modules/proxyHandler.js';
import { log } from './modules/logger.js';

/**
 * Тестовый скрипт для диагностики прокси
 * Проверяет доступность и работоспособность прокси из WebShare
 */
async function testProxies() {
  try {
    log('🧪 [PROXY-TEST] Запуск тестирования прокси...', 'info');
    
    // Создаем обработчик прокси
    const proxyHandler = new ProxyHandler();
    
    // Инициализируем (загружаем прокси из WebShare)
    log('📡 [PROXY-TEST] Загружаем прокси из WebShare API...', 'info');
    const initialized = await proxyHandler.initialize();
    
    if (!initialized) {
      log('❌ [PROXY-TEST] Не удалось загрузить прокси!', 'error');
      return;
    }
    
    log(`✅ [PROXY-TEST] Загружено ${proxyHandler.proxyList.length} прокси`, 'success');
    
    // Тестируем первые 5 прокси
    const maxTestCount = Math.min(5, proxyHandler.proxyList.length);
    log(`🔬 [PROXY-TEST] Тестируем первые ${maxTestCount} прокси...`, 'info');
    
    let workingCount = 0;
    let deadCount = 0;
    let timeoutCount = 0;
    
    for (let i = 0; i < maxTestCount; i++) {
      const proxy = proxyHandler.proxyList[i];
      log(`\n🎯 [PROXY-TEST] Тест ${i + 1}/${maxTestCount}: ${proxy.host}:${proxy.port} (${proxy.country})`, 'info');
      
      try {
        // Тестируем подключение к vseinstrumenti.ru
        const isWorking = await proxyHandler.testProxyConnection(proxy);
        
        if (isWorking) {
          workingCount++;
          log(`✅ [PROXY-TEST] Прокси ${i + 1} работает!`, 'success');
        } else {
          if (proxy.lastFailReason && proxy.lastFailReason.includes('TUNNEL_CONNECTION_FAILED')) {
            deadCount++;
            log(`💀 [PROXY-TEST] Прокси ${i + 1} мертв (не подключается)`, 'error');
          } else if (proxy.lastFailReason && proxy.lastFailReason.includes('TIMEOUT')) {
            timeoutCount++;
            log(`⏰ [PROXY-TEST] Прокси ${i + 1} слишком медленный`, 'warning');
          } else {
            deadCount++;
            log(`❌ [PROXY-TEST] Прокси ${i + 1} не работает`, 'error');
          }
        }
      } catch (error) {
        deadCount++;
        log(`💥 [PROXY-TEST] Прокси ${i + 1} ошибка: ${error.message}`, 'error');
      }
      
      // Небольшая пауза между тестами
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Статистика тестирования
    log('\n📊 [PROXY-TEST] РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:', 'info');
    log(`├── Всего протестировано: ${maxTestCount}`, 'info');
    log(`├── ✅ Работающих: ${workingCount} (${(workingCount/maxTestCount*100).toFixed(1)}%)`, 'success');
    log(`├── 💀 Мертвых: ${deadCount} (${(deadCount/maxTestCount*100).toFixed(1)}%)`, 'error');
    log(`└── ⏰ Медленных: ${timeoutCount} (${(timeoutCount/maxTestCount*100).toFixed(1)}%)`, 'warning');
    
    if (workingCount === 0) {
      log('🚨 [PROXY-TEST] КРИТИЧЕСКАЯ ПРОБЛЕМА: Ни одного рабочего прокси не найдено!', 'error');
      log('💡 [PROXY-TEST] Возможные причины:', 'info');
      log('   1. Проблемы с интернет соединением', 'info');
      log('   2. Прокси сервера WebShare недоступны', 'info');
      log('   3. Неверные учетные данные API', 'info');
      log('   4. Блокировка прокси провайдером/файрволом', 'info');
    } else if (workingCount < maxTestCount * 0.5) {
      log('⚠️ [PROXY-TEST] ПРЕДУПРЕЖДЕНИЕ: Менее 50% прокси работают', 'warning');
      log('💡 [PROXY-TEST] Рекомендуется проверить качество прокси в панели WebShare', 'info');
    } else {
      log('🎉 [PROXY-TEST] Прокси работают нормально!', 'success');
    }
    
    // Тестируем получение следующего рабочего прокси
    log('\n🔄 [PROXY-TEST] Тестируем getNextWorkingProxy()...', 'info');
    try {
      const nextProxy = await proxyHandler.getNextWorkingProxy();
      if (nextProxy) {
        log(`✅ [PROXY-TEST] getNextWorkingProxy() вернул: ${nextProxy.host}:${nextProxy.port}`, 'success');
      } else {
        log(`❌ [PROXY-TEST] getNextWorkingProxy() вернул null`, 'error');
      }
    } catch (error) {
      log(`💥 [PROXY-TEST] getNextWorkingProxy() ошибка: ${error.message}`, 'error');
    }
    
    log('\n🏁 [PROXY-TEST] Тестирование завершено', 'info');
    
  } catch (error) {
    log(`💥 [PROXY-TEST] Критическая ошибка: ${error.message}`, 'error');
    console.error(error);
  }
}

// Запускаем тест
testProxies().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 