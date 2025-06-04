import puppeteer from 'puppeteer';

console.log('🔬 ДЕТАЛЬНЫЙ АНАЛИЗ: Что меняется в браузере между запросами\n');

const browser = await puppeteer.launch({ 
  headless: 'new',
  dumpio: true  // Видим все логи браузера
});
const page = await browser.newPage();

// Функция для глубокого анализа состояния браузера
const analyzeBrowserState = async (moment) => {
  console.log(`\n=== СОСТОЯНИЕ БРАУЗЕРА: ${moment} ===`);
  
  const analysis = await page.evaluate(() => {
    const state = {};
    
    // 1. Navigator properties
    state.navigator = {
      userAgent: navigator.userAgent,
      webdriver: navigator.webdriver,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      doNotTrack: navigator.doNotTrack,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints
    };
    
    // 2. Screen properties  
    state.screen = {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    };
    
    // 3. Window properties
    state.window = {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
      screenX: window.screenX,
      screenY: window.screenY
    };
    
    // 4. WebGL context
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        state.webgl = {
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER),
          version: gl.getParameter(gl.VERSION),
          shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
          extensions: gl.getSupportedExtensions()?.length || 0
        };
      } else {
        state.webgl = { error: 'WebGL not available' };
      }
    } catch (e) {
      state.webgl = { error: e.message };
    }
    
    // 5. Canvas fingerprint
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Browser fingerprint test 🔬', 2, 2);
        state.canvasFingerprint = canvas.toDataURL().substring(0, 100) + '...';
      }
    } catch (e) {
      state.canvasFingerprint = { error: e.message };
    }
    
    // 6. Timing APIs
    state.timing = {
      performanceNowAvailable: typeof performance.now === 'function',
      performanceNow: typeof performance.now === 'function' ? performance.now() : null,
      dateNow: Date.now(),
      timeOrigin: performance.timeOrigin || null
    };
    
    // 7. Chrome API availability
    state.chrome = {
      available: typeof window.chrome !== 'undefined',
      runtime: typeof window.chrome?.runtime !== 'undefined',
      loadTimes: typeof window.chrome?.loadTimes === 'function'
    };
    
    // 8. Permissions API
    state.permissions = {
      available: typeof navigator.permissions !== 'undefined',
      query: typeof navigator.permissions?.query === 'function'
    };
    
    // 9. Document state
    state.document = {
      readyState: document.readyState,
      hidden: document.hidden,
      visibilityState: document.visibilityState,
      hasFocus: document.hasFocus(),
      title: document.title,
      url: document.URL,
      domain: document.domain,
      referrer: document.referrer
    };
    
    // 10. Storage availability
    state.storage = {};
    try {
      state.storage.localStorage = typeof localStorage !== 'undefined' && localStorage !== null;
      state.storage.sessionStorage = typeof sessionStorage !== 'undefined' && sessionStorage !== null;
      state.storage.indexedDB = typeof indexedDB !== 'undefined';
    } catch (e) {
      state.storage.error = e.message;
    }
    
    return state;
  });
  
  console.log('📊 Navigator:', JSON.stringify(analysis.navigator, null, 2));
  console.log('🖥️ Screen:', JSON.stringify(analysis.screen, null, 2));
  console.log('🪟 Window:', JSON.stringify(analysis.window, null, 2));
  console.log('🎨 WebGL:', JSON.stringify(analysis.webgl, null, 2));
  console.log('🖼️ Canvas:', analysis.canvasFingerprint);
  console.log('⏱️ Timing:', JSON.stringify(analysis.timing, null, 2));
  console.log('🔧 Chrome API:', JSON.stringify(analysis.chrome, null, 2));
  console.log('🔐 Permissions:', JSON.stringify(analysis.permissions, null, 2));
  console.log('📄 Document:', JSON.stringify(analysis.document, null, 2));
  console.log('💾 Storage:', JSON.stringify(analysis.storage, null, 2));
  
  return analysis;
};

// Анализ ДО первого запроса
const stateBefore = await analyzeBrowserState('ДО первого запроса');

// Первый запрос
console.log('\n🚀 ДЕЛАЕМ ПЕРВЫЙ ЗАПРОС...');
const startTime = Date.now();
try {
  const response1 = await page.goto('https://www.vseinstrumenti.ru/', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000 
  });
  console.log(`✅ Первый запрос завершен: ${response1.status()} (${Date.now() - startTime}ms)`);
} catch (error) {
  console.log(`❌ Ошибка первого запроса: ${error.message}`);
}

// Анализ ПОСЛЕ первого запроса
const stateAfter = await analyzeBrowserState('ПОСЛЕ первого запроса');

// Сравнение изменений
console.log('\n🔍 АНАЛИЗ ИЗМЕНЕНИЙ:');

const compareObjects = (before, after, path = '') => {
  for (const key in before) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (typeof before[key] === 'object' && before[key] !== null && after[key] !== null) {
      compareObjects(before[key], after[key], currentPath);
    } else if (before[key] !== after[key]) {
      console.log(`🔄 ${currentPath}: ${JSON.stringify(before[key])} → ${JSON.stringify(after[key])}`);
    }
  }
};

compareObjects(stateBefore, stateAfter);

// Пауза 3 секунды
console.log('\n⏳ Ждем 3 секунды...');
await new Promise(resolve => setTimeout(resolve, 3000));

// Второй запрос
console.log('\n🚀 ДЕЛАЕМ ВТОРОЙ ЗАПРОС...');
const startTime2 = Date.now();
try {
  const response2 = await page.goto('https://www.vseinstrumenti.ru/', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000 
  });
  console.log(`✅ Второй запрос завершен: ${response2.status()} (${Date.now() - startTime2}ms)`);
} catch (error) {
  console.log(`❌ Ошибка второго запроса: ${error.message}`);
}

// Анализ ПОСЛЕ второго запроса  
const stateAfterSecond = await analyzeBrowserState('ПОСЛЕ второго запроса');

console.log('\n🔍 ИЗМЕНЕНИЯ ПОСЛЕ ВТОРОГО ЗАПРОСА:');
compareObjects(stateAfter, stateAfterSecond);

await browser.close();
console.log('\n✅ Анализ завершен!'); 