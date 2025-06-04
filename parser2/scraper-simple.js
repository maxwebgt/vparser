// Простая и эффективная логика навигации для замены в основном файле

// 🚀 ПРОСТАЯ УМНАЯ НАВИГАЦИЯ
async function simpleSmartNavigation(page, url, proxyHandler, pageTimeoutMs) {
  log(`🔍 [SMART-NAV] URL: ${shortenUrl(url)}`, 'debug');
  
  // Для vseinstrumenti.ru используем умную навигацию
  if (url.includes('vseinstrumenti.ru')) {
    log(`🚀 [SMART-NAV] Используем умную навигацию для vseinstrumenti.ru`, 'info');
    
    const navigationSuccess = await smartProductScraping(page, url, CITY_CONFIG.representId, proxyHandler);
    
    // Проверяем результат
    if (!navigationSuccess.success) {
      log(`❌ [SMART-NAV] Умная навигация требует дальнейших действий: ${navigationSuccess.reason}`, 'warning');
      
      // Возвращаем результат для обработки в основном цикле
      return navigationSuccess;
    }
    
    log(`✅ [SMART-NAV] Умная навигация успешна (тип: ${navigationSuccess.stage})`, 'success');
    return { success: true, status: 200, reason: 'SMART_NAVIGATION_SUCCESS' };
    
  } else {
    // Для остальных сайтов используем прямую навигацию
    log(`🚀 [SIMPLE-NAV] Прямая навигация для другого сайта`, 'info');
    
    const simpleNavResult = await safeNavigate(page, url, { timeout: pageTimeoutMs });
    
    if (!simpleNavResult.success) {
      log(`❌ [SIMPLE-NAV] Прямая навигация не удалась: ${simpleNavResult.error}`, 'warning');
      return simpleNavResult;
    }
    
    log(`✅ [SIMPLE-NAV] Страница загружена (статус: ${simpleNavResult.status})`, 'info');
    return { success: true, status: simpleNavResult.status, reason: 'SIMPLE_NAVIGATION_SUCCESS' };
  }
}

// Пример использования в основном цикле:
/*
// Clear cookies before navigation to help prevent redirect loops
await clearCookiesForDomain(page);

// Выполняем навигацию
const navigationResult = await simpleSmartNavigation(page, url, proxyHandler, pageTimeoutMs);

if (!navigationResult.success) {
  // Если нужен прокси и мы его еще не используем
  if (navigationResult.needsProxy && !usedProxy && PROXY_CONFIG.useProxy) {
    log(`🔒 [NAV] Требуется прокси (${navigationResult.reason})`, 'proxy');
    botProtectionDetected = true;
    continue; // Начинаем новую итерацию с прокси
  }
  
  // Если 403 через прокси - помечаем прокси как failed
  if (navigationResult.status === 403 && usedProxy && currentProxy) {
    log(`🔴 [NAV] Прокси ${currentProxy.host}:${currentProxy.port} не обошел защиту - помечаем как failed`, 'proxy');
    proxyHandler.markProxyAsFailed(currentProxy, 'HTTP_403_NAVIGATION');
    
    // Сбрасываем флаги и пробуем с новым прокси
    usedProxy = false;
    currentProxy = null;
    botProtectionDetected = true;
    continue;
  }
  
  // Если другая ошибка
  throw new Error(`Navigation failed: ${navigationResult.reason || navigationResult.error}`);
}

// Проверяем на redirect loops и bot protection
const pageUrl = page.url();
if (pageUrl.includes('/xpvnsulc/')) {
  log(`🚫 Bot protection detected: URL contains /xpvnsulc/`, 'warning');
  botProtectionDetected = true;
  
  const shouldUseProxy = proxyHandler.registerProtectionHit();
  log(`🔒 Bot protection registered. Total hits: ${proxyHandler.getProtectionHitCount()}, Should use proxy: ${shouldUseProxy}`, 'proxy');
  
  if (usedProxy) {
    log(`❌ Proxy ${currentProxy.host}:${currentProxy.port} failed to bypass protection`, 'proxy');
    proxyHandler.registerProxyFailure(currentProxy);
    
    if (attempt >= MAX_RETRIES - 1) {
      log(`❌ Maximum retries reached with proxy still failing, skipping product`, 'warning');
      break;
    }
  }
  
  continue;
}

// Wait a bit for dynamic content
await new Promise(resolve => setTimeout(resolve, 2000));
*/ 