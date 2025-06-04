import puppeteer from 'puppeteer';

console.log('🔍 ТЕСТ: Детекция Chrome DevTools Protocol\n');

const testDevToolsDetection = async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
  
  const page = await browser.newPage();
  
  // МАКСИМАЛЬНАЯ АНТИ-ДЕТЕКЦИЯ
  await page.evaluateOnNewDocument(() => {
    // 1. Удаляем все следы automation
    delete navigator.__proto__.webdriver;
    delete window.navigator.webdriver;
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
    
    // 2. Удаляем DevTools следы
    delete window.chrome.runtime;
    
    // 3. Перехватываем детекцию через console
    const originalLog = console.log;
    console.log = function(...args) {
      // Не логируем подозрительные вещи
      const message = args.join(' ');
      if (!message.includes('puppeteer') && !message.includes('webdriver')) {
        originalLog.apply(console, args);
      }
    };
    
    // 4. Маскируем функции которые могут выдать автоматизацию
    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function() {
      if (this === navigator.permissions.query) {
        return 'function query() { [native code] }';
      }
      return originalToString.apply(this, arguments);
    };
    
    // 5. КРИТИЧНО: Скрываем что мы в iframe или WebDriver контексте
    Object.defineProperty(window, 'top', {
      get: () => window,
      configurable: true
    });
    
    Object.defineProperty(window, 'parent', {
      get: () => window, 
      configurable: true
    });
  });
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36');
  
  console.log('🕵️ Проверяем что детектирует сайт...');
  
  // Сначала проверяем что браузер может детектировать
  const detectionResults = await page.evaluate(() => {
    const results = {};
    
    results.webdriver = navigator.webdriver;
    results.processExists = typeof process !== 'undefined';
    results.chromeRuntime = typeof window.chrome !== 'undefined' && typeof window.chrome.runtime !== 'undefined';
    results.devtools = window.outerHeight - window.innerHeight > 200;
    results.iframe = window !== window.top;
    results.permissions = navigator.permissions ? 'available' : 'missing';
    
    return results;
  });
  
  console.log('🔍 Результаты детекции:', JSON.stringify(detectionResults, null, 2));
  
  try {
    const response = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log(`✅ РЕЗУЛЬТАТ: ${response.status()}`);
    
  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

await testDevToolsDetection();

console.log('\n🏁 Тест детекции завершен!'); 