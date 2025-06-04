import { ProxyHandler } from './modules/proxyHandler.js';
import { log } from './modules/logger.js';

// Функция для детального тестирования прокси с новой логикой
async function testProxiesDetailed() {
  try {
    log('🚀 [PROXY-DIAGNOSIS] Запуск детальной диагностики прокси...', 'info');
    
    // Инициализация ProxyHandler
    const proxyHandler = new ProxyHandler();
    await proxyHandler.initialize();
    
    const proxyList = proxyHandler.proxyList;
    log(`📊 [PROXY-DIAGNOSIS] Загружено ${proxyList.length} прокси из WebShare API`, 'info');
    
    if (proxyList.length === 0) {
      log('❌ [PROXY-DIAGNOSIS] Нет доступных прокси для тестирования!', 'error');
      return;
    }
    
    // Тестируем первые 10 прокси детально
    const testCount = Math.min(10, proxyList.length);
    log(`🧪 [PROXY-DIAGNOSIS] Тестируем первые ${testCount} прокси детально...`, 'info');
    
    let workingOnTarget = 0;
    let workingPartially = 0;
    let completelyBroken = 0;
    
    for (let i = 0; i < testCount; i++) {
      const proxy = proxyList[i];
      log(`\n🔍 [${i+1}/${testCount}] Тестируем прокси ${proxy.host}:${proxy.port} (${proxy.country})`, 'info');
      
      // Тест 1: Проверка на целевом сайте
      log(`  📍 Тест 1: Целевой сайт (vseinstrumenti.ru)`, 'info');
      const targetResult = await proxyHandler.testProxyConnection(proxy);
      
      // Тест 2: Проверка качества на альтернативных сайтах
      log(`  📍 Тест 2: Альтернативные сайты`, 'info');
      const qualityResult = await proxyHandler.testProxyQuality(proxy);
      
      // Анализ результатов
      if (targetResult) {
        log(`  ✅ ИДЕАЛЬНЫЙ ПРОКСИ: Работает на целевом сайте!`, 'success');
        workingOnTarget++;
      } else if (qualityResult.working && qualityResult.workingSites >= 2) {
        log(`  ⚠️ ЧАСТИЧНО РАБОЧИЙ: Целевой сайт блокирует, но работает на ${qualityResult.workingSites}/${qualityResult.totalSites} альтернативных сайтах`, 'warning');
        workingPartially++;
      } else {
        log(`  ❌ СЛОМАННЫЙ: Не работает ни на одном сайте`, 'error');
        completelyBroken++;
      }
    }
    
    // Итоговая статистика
    log('\n📈 [PROXY-DIAGNOSIS] ИТОГОВАЯ СТАТИСТИКА:', 'info');
    log('┌─────────────────────────────────────────────────────┐', 'info');
    log(`│ Протестировано прокси: ${testCount.toString().padStart(24)} │`, 'info');
    log(`│ ✅ Работают на целевом сайте: ${workingOnTarget.toString().padStart(16)} │`, 'info');
    log(`│ ⚠️ Работают частично: ${workingPartially.toString().padStart(20)} │`, 'info');
    log(`│ ❌ Полностью сломаны: ${completelyBroken.toString().padStart(20)} │`, 'info');
    log('└─────────────────────────────────────────────────────┘', 'info');
    
    const workingPercentage = ((workingOnTarget + workingPartially) / testCount * 100).toFixed(1);
    const idealPercentage = (workingOnTarget / testCount * 100).toFixed(1);
    
    log(`📊 Общая работоспособность: ${workingPercentage}% (из них идеально работающих: ${idealPercentage}%)`, 'info');
    
    // Тестирование функции getNextWorkingProxy
    log('\n🔄 [PROXY-DIAGNOSIS] Тестируем getNextWorkingProxy()...', 'info');
    
    for (let i = 0; i < 3; i++) {
      log(`\n🎯 Попытка ${i+1}: Получаем рабочий прокси...`, 'info');
      const selectedProxy = await proxyHandler.getNextWorkingProxy();
      
      if (selectedProxy) {
        log(`✅ Получен прокси: ${selectedProxy.host}:${selectedProxy.port} (${selectedProxy.country})`, 'success');
      } else {
        log(`❌ Не удалось получить рабочий прокси!`, 'error');
        break;
      }
    }
    
    // Рекомендации
    log('\n💡 [PROXY-DIAGNOSIS] РЕКОМЕНДАЦИИ:', 'info');
    
    if (workingOnTarget === 0) {
      log('🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА: Ни один прокси не может обойти защиту vseinstrumenti.ru!', 'error');
      log('🔧 Возможные решения:', 'error');
      log('   1. Сменить провайдера прокси (WebShare, возможно, заблокирован)', 'error');
      log('   2. Использовать резидентские прокси вместо датацентровых', 'error');
      log('   3. Добавить ротацию User-Agent и других заголовков', 'error');
      log('   4. Увеличить задержки между запросами', 'error');
    } else if (workingOnTarget < testCount * 0.3) {
      log('⚠️ ПРОБЛЕМА: Мало прокси могут обойти защиту сайта', 'warning');
      log('🔧 Рекомендации: добавить больше разнообразных прокси или улучшить анти-детекцию', 'warning');
    } else {
      log('✅ ХОРОШО: Достаточно прокси работают на целевом сайте', 'success');
    }
    
    if (completelyBroken > testCount * 0.5) {
      log('⚠️ ВНИМАНИЕ: Много полностью сломанных прокси - стоит обновить список', 'warning');
    }
    
  } catch (error) {
    log(`❌ [PROXY-DIAGNOSIS] Ошибка: ${error.message}`, 'error');
    console.error(error);
  }
}

// Запуск тестирования
testProxiesDetailed(); 