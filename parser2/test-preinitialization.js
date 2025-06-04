import puppeteer from 'puppeteer';

console.log('🧪 ТЕСТ: Предварительная инициализация браузера\n');

const testPreinitialization = async () => {
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
  
  // Применяем анти-детекцию (как в твоем коде)
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
    delete navigator.__proto__.webdriver;
  });
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36');
  
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
    'Upgrade-Insecure-Requests': '1'
  };
  
  await page.setExtraHTTPHeaders(professionalHeaders);
  await page.setViewport({ width: 1920, height: 1080 });
  
  // === ТЕСТ 1: БЕЗ предварительной инициализации ===
  console.log('=== ТЕСТ 1: Прямой запрос (без инициализации) ===');
  try {
    const response1 = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log(`Статус: ${response1.status()}`);
  } catch (error) {
    console.log(`Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

const testWithPreinitialization = async () => {
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
  
  // Применяем анти-детекцию
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
    delete navigator.__proto__.webdriver;
  });
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36');
  
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
    'Upgrade-Insecure-Requests': '1'
  };
  
  await page.setExtraHTTPHeaders(professionalHeaders);
  await page.setViewport({ width: 1920, height: 1080 });
  
  // === ТЕСТ 2: С предварительной инициализацией ===
  console.log('\n=== ТЕСТ 2: С предварительной инициализацией ===');
  
  // ШАГИ ИНИЦИАЛИЗАЦИИ:
  console.log('🔄 Инициализация 1: Загружаем пустую HTML страницу...');
  await page.goto('data:text/html,<html><body>Инициализация браузера...</body></html>');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('🔄 Инициализация 2: Загружаем Google для стабилизации...');
  await page.goto('https://www.google.com');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('🔄 Инициализация 3: Имитируем человеческую активность...');
  await page.mouse.move(500, 300);
  await page.mouse.move(600, 400);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('✅ Инициализация завершена, тестируем основной сайт...');
  
  try {
    const response2 = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log(`Статус после инициализации: ${response2.status()}`);
  } catch (error) {
    console.log(`Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

// Запускаем тесты
await testPreinitialization();
await testWithPreinitialization();

console.log('\n🏁 Тестирование завершено!'); 