import puppeteer from 'puppeteer';

console.log('🔍 СРАВНЕНИЕ: Реальный браузер VS Бот\n');

// ТЕСТ 1: Максимально реальный браузер (НЕ headless)
const testRealBrowser = async () => {
  console.log('=== ТЕСТ 1: Максимально реальный браузер ===');
  
  const browser = await puppeteer.launch({ 
    headless: false,  // РЕАЛЬНОЕ ОКНО БРАУЗЕРА!
    devtools: false,
    args: [
      '--start-maximized',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  const page = await browser.newPage();
  
  // Минимальные настройки как в реальном браузере
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('🌐 Переходим на vseinstrumenti.ru (как реальный пользователь)...');
  
  try {
    const response = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log(`✅ РЕАЛЬНЫЙ БРАУЗЕР: ${response.status()}`);
    
    // Ждем 5 секунд чтобы увидеть страницу
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

// ТЕСТ 2: Headless с предварительными запросами (имитация реального поведения)
const testWithPreRequests = async () => {
  console.log('\n=== ТЕСТ 2: Headless + предварительные запросы ===');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  // Применяем базовую анти-детекцию
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
  });
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36');
  
  console.log('🔄 Шаг 1: Имитируем "холодный старт" реального браузера...');
  
  // ЧТО ДЕЛАЕТ РЕАЛЬНЫЙ БРАУЗЕР ПРИ ЗАПУСКЕ:
  // 1. Загружает начальную страницу (about:blank или стартовую)
  console.log('📄 Загружаем стартовую страницу...');
  await page.goto('about:blank');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 2. Делает DNS предзапросы
  console.log('🌐 Делаем предварительный DNS запрос...');
  await page.evaluateOnNewDocument(() => {
    // Предзапрос DNS (как делает реальный браузер)
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = 'https://www.vseinstrumenti.ru';
    document.head.appendChild(link);
  });
  
  // 3. Устанавливает соединения
  console.log('🔗 Предварительное соединение...');
  await page.evaluateOnNewDocument(() => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://www.vseinstrumenti.ru';
    document.head.appendChild(link);
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('🎯 Основной запрос...');
  try {
    const response = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log(`✅ С ПРЕДЗАПРОСАМИ: ${response.status()}`);
  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

// ТЕСТ 3: С имитацией истории браузера
const testWithHistory = async () => {
  console.log('\n=== ТЕСТ 3: С имитацией истории браузера ===');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
  });
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36');
  
  console.log('📚 Создаем "историю" браузера...');
  
  // Имитируем что браузер уже работал
  await page.goto('https://www.google.com');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await page.goto('https://yandex.ru');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('🎯 Теперь переходим на основной сайт...');
  try {
    const response = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log(`✅ С ИСТОРИЕЙ: ${response.status()}`);
  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

// Запускаем все тесты
await testRealBrowser();
await testWithPreRequests();
await testWithHistory();

console.log('\n🏁 Анализ различий завершен!'); 