import puppeteer from 'puppeteer';

console.log('🧪 ТЕСТИРУЕМ СПОСОБЫ ПРЕДВАРИТЕЛЬНОГО СОЗРЕВАНИЯ БРАУЗЕРА\n');

// ТЕСТ 1: Предварительный "прогрев" на безопасном сайте
const testSafeWarmup = async () => {
  console.log('=== ТЕСТ 1: Прогрев на безопасном сайте ===');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--exclude-switch=enable-automation'
    ]
  });
  const page = await browser.newPage();
  
  // Устанавливаем анти-детекцию
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
    delete navigator.__proto__.webdriver;
  });
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
  
  try {
    // Сначала идем на безопасный сайт для "прогрева"
    console.log('🌐 Прогреваемся на google.com...');
    const warmupResponse = await page.goto('https://www.google.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    console.log(`✅ Прогрев: ${warmupResponse.status()}`);
    
    // Ждем немного
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Теперь сразу идем на целевой сайт
    console.log('🎯 Переходим на vseinstrumenti.ru...');
    const targetResponse = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    console.log(`🎯 Целевой сайт: ${targetResponse.status()}`);
    
  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

// ТЕСТ 2: Максимальная предварительная настройка
const testMaxPreSetup = async () => {
  console.log('\n=== ТЕСТ 2: Максимальная предварительная настройка ===');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--exclude-switch=enable-automation',
      '--disable-extensions-file-access-check',
      '--disable-extensions-http-throttling',
      '--disable-ipc-flooding-protection'
    ]
  });
  const page = await browser.newPage();
  
  // МАКСИМАЛЬНАЯ анти-детекция перед любыми запросами
  await page.evaluateOnNewDocument(() => {
    // Полная анти-детекция
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
    delete navigator.__proto__.webdriver;
    
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
      configurable: true
    });
    
    Object.defineProperty(screen, 'width', { get: () => 1920 });
    Object.defineProperty(screen, 'height', { get: () => 1080 });
    
    window.chrome = {
      runtime: {
        onMessage: {},
        onConnect: {},
        sendMessage: function() {},
        connect: function() {}
      },
      loadTimes: function() {
        return {
          requestTime: Date.now() / 1000,
          startLoadTime: Date.now() / 1000,
          commitLoadTime: Date.now() / 1000,
          finishDocumentLoadTime: Date.now() / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintTime: Date.now() / 1000
        };
      }
    };
    
    // Удаляем automation следы
    if (document.documentElement) {
      document.documentElement.removeAttribute('webdriver');
    }
  });
  
  // Реалистичные заголовки
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="121", "Google Chrome";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  });
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
  
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1
  });
  
  // Предварительная "инициализация" браузера через about:blank
  console.log('🔧 Предварительная инициализация...');
  await page.goto('about:blank');
  
  // Инициализируем все API
  await page.evaluate(() => {
    // Принудительно инициализируем WebGL
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      gl.getParameter(gl.VENDOR);
      gl.getParameter(gl.RENDERER);
    }
    
    // Инициализируем canvas fingerprint
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('test', 2, 2);
      canvas.toDataURL();
    }
    
    // Инициализируем timing API
    if (performance.now) {
      performance.now();
    }
    
    return true;
  });
  
  // Медленный переход (имитируем человека)
  console.log('🐌 Медленный переход на сайт...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    const response = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    console.log(`🎯 Результат с максимальной настройкой: ${response.status()}`);
  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

// ТЕСТ 3: Предварительная загрузка ресурсов
const testResourcePreload = async () => {
  console.log('\n=== ТЕСТ 3: Предварительная загрузка ресурсов ===');
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
  });
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
  
  try {
    // Сначала загружаем только ресурсы (CSS, favicon, etc) через fetch
    console.log('📦 Предварительная загрузка ресурсов...');
    await page.evaluate(async () => {
      try {
        // Пытаемся загрузить favicon и CSS для "знакомства" с доменом
        await fetch('https://www.vseinstrumenti.ru/favicon.ico', { method: 'HEAD' });
      } catch (e) {
        console.log('Favicon fetch failed:', e.message);
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Теперь основная страница
    console.log('🎯 Загружаем основную страницу...');
    const response = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    console.log(`🎯 Результат с предзагрузкой: ${response.status()}`);
    
  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

// ТЕСТ 4: Использование реального браузера (не headless)
const testRealBrowser = async () => {
  console.log('\n=== ТЕСТ 4: Реальный браузер (не headless) ===');
  
  const browser = await puppeteer.launch({ 
    headless: false,  // РЕАЛЬНЫЙ браузер!
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  try {
    const response = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    console.log(`🎯 Результат с реальным браузером: ${response.status()}`);
    
    // Небольшая пауза чтобы увидеть браузер
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

// Запускаем все тесты
await testSafeWarmup();
await testMaxPreSetup();
await testResourcePreload();
// await testRealBrowser(); // Раскомментируй если хочешь увидеть реальный браузер

console.log('\n✅ Все тесты завершены!'); 