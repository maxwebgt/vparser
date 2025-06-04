import puppeteer from 'puppeteer';

console.log('🍪 АНАЛИЗ: Что происходит с куками между запросами\n');

const analyzeCookieChanges = async () => {
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
  
  // ТОЧНАЯ КОПИЯ анти-детекции из рабочего кода
  const professionalHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="136", "Google Chrome";v="136"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Connection': 'keep-alive',
    'DNT': '1',
    'Sec-GPC': '1'
  };
  
  await page.setExtraHTTPHeaders(professionalHeaders);
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false });
  
  // ТОЧНАЯ КОПИЯ анти-детекции
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
      configurable: true
    });
    
    Object.defineProperty(screen, 'width', { get: () => 1920, configurable: true });
    Object.defineProperty(screen, 'height', { get: () => 1080, configurable: true });
    Object.defineProperty(screen, 'availWidth', { get: () => 1920, configurable: true });
    Object.defineProperty(screen, 'availHeight', { get: () => 1040, configurable: true });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24, configurable: true });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24, configurable: true });
    
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
    delete navigator.__proto__.webdriver;
    
    Object.defineProperty(navigator, 'language', {
      get: () => 'ru-RU',
      configurable: true
    });
    
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ru-RU', 'ru', 'en-US', 'en'],
      configurable: true
    });
    
    window.navigator.webdriver = false;
    delete window.navigator.webdriver;
    
    if (document.documentElement) {
      document.documentElement.removeAttribute('webdriver');
    }
  });
  
  console.log('📊 ПЕРВЫЙ ЗАПРОС - анализируем куки ДО и ПОСЛЕ...');
  
  // Куки ДО первого запроса
  const cookiesBeforeFirst = await page.cookies();
  console.log(`🍪 Куки ДО первого запроса: ${cookiesBeforeFirst.length}`);
  
  // ПЕРВЫЙ ЗАПРОС
  const initialDelay = Math.floor(Math.random() * 1000) + 500;
  console.log(`⏰ Начальная задержка: ${initialDelay}ms`);
  await new Promise(resolve => setTimeout(resolve, initialDelay));
  
  const response1 = await page.goto('https://www.vseinstrumenti.ru/', { 
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });
  
  console.log(`✅ ПЕРВЫЙ ЗАПРОС: ${response1.status()}`);
  
  // Куки ПОСЛЕ первого запроса
  const cookiesAfterFirst = await page.cookies();
  console.log(`🍪 Куки ПОСЛЕ первого запроса: ${cookiesAfterFirst.length}`);
  
  if (cookiesAfterFirst.length > cookiesBeforeFirst.length) {
    console.log('🔑 НОВЫЕ КУКИ УСТАНОВЛЕНЫ:');
    cookiesAfterFirst.forEach(cookie => {
      console.log(`   - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
    });
  }
  
  // Ждем 3 секунды как в рабочем коде
  console.log('⏳ Ждем 3 секунды (как в рабочем коде)...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('📊 ВТОРОЙ ЗАПРОС - проверяем изменения...');
  
  // ВТОРОЙ ЗАПРОС
  const response2 = await page.goto('https://www.vseinstrumenti.ru/', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000 
  });
  
  console.log(`✅ ВТОРОЙ ЗАПРОС: ${response2.status()}`);
  
  // Куки ПОСЛЕ второго запроса
  const cookiesAfterSecond = await page.cookies();
  console.log(`🍪 Куки ПОСЛЕ второго запроса: ${cookiesAfterSecond.length}`);
  
  // Сравнение кук
  if (cookiesAfterSecond.length !== cookiesAfterFirst.length) {
    console.log('🔄 КУКИ ИЗМЕНИЛИСЬ между запросами!');
  }
  
  // Проверяем localStorage
  const localStorage = await page.evaluate(() => {
    const storage = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      storage[key] = window.localStorage.getItem(key);
    }
    return storage;
  });
  
  console.log(`💾 localStorage записей: ${Object.keys(localStorage).length}`);
  Object.keys(localStorage).forEach(key => {
    console.log(`   - ${key}: ${localStorage[key].substring(0, 20)}...`);
  });
  
  await browser.close();
};

await analyzeCookieChanges();

console.log('\n🏁 Анализ кук завершен!'); 