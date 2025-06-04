import puppeteer from 'puppeteer';

console.log('🚀 ОПТИМИЗИРОВАННЫЙ ПРОГРЕВ: Ждем куки вместо фиксированного времени\n');

const optimizedWarmup = async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    dumpio: true,  // ← ВКЛЮЧАЕМ ВСЕ ЛОГИ БРАУЗЕРА!
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--exclude-switch=enable-automation',
      '--enable-logging',
      '--log-level=0',
      '--v=1'
    ]
  });
  
  const page = await browser.newPage();
  
  // Полная анти-детекция (точная копия из рабочего кода)
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
  
  // Полная анти-детекция
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32', configurable: true });
    Object.defineProperty(screen, 'width', { get: () => 1920, configurable: true });
    Object.defineProperty(screen, 'height', { get: () => 1080, configurable: true });
    Object.defineProperty(screen, 'availWidth', { get: () => 1920, configurable: true });
    Object.defineProperty(screen, 'availHeight', { get: () => 1040, configurable: true });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24, configurable: true });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24, configurable: true });
    
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
    delete navigator.__proto__.webdriver;
    
    Object.defineProperty(navigator, 'language', { get: () => 'ru-RU', configurable: true });
    Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US', 'en'], configurable: true });
    
    window.navigator.webdriver = false;
    delete window.navigator.webdriver;
    
    if (document.documentElement) {
      document.documentElement.removeAttribute('webdriver');
    }
  });
  
  console.log('🔥 УМНЫЙ ПРОГРЕВ: Ждем пока антибот установит куки...');
  console.log('📊 DUMPIO ВКЛЮЧЕН - увидим все внутренние логи браузера!\n');
  
  // Включаем детальное логирование
  page.on('console', msg => {
    console.log(`🖥️  [PAGE CONSOLE ${msg.type().toUpperCase()}]:`, msg.text());
  });
  
  page.on('pageerror', error => {
    console.log(`❌ [PAGE ERROR]:`, error.message);
  });
  
  page.on('response', response => {
    console.log(`📡 [RESPONSE]: ${response.status()} ${response.url()}`);
  });
  
  // ПЕРВЫЙ ЗАПРОС (403, но получаем куки)
  const initialDelay = Math.floor(Math.random() * 1000) + 500;
  console.log(`⏰ Начальная задержка: ${initialDelay}ms`);
  await new Promise(resolve => setTimeout(resolve, initialDelay));
  
  const startTime = Date.now();
  const response1 = await page.goto('https://www.vseinstrumenti.ru/', { 
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });
  
  console.log(`✅ ПЕРВЫЙ ЗАПРОС: ${response1.status()} за ${Date.now() - startTime}ms`);
  
  if (response1.status() === 403) {
    console.log('🔄 HTTP 403 - ждем установки антибот кук...');
    
    // УМНОЕ ОЖИДАНИЕ: проверяем куки каждые 500ms
    let cookieCount = 0;
    let attempts = 0;
    const maxAttempts = 10; // максимум 5 секунд
    
    while (cookieCount === 0 && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const cookies = await page.cookies();
      cookieCount = cookies.length;
      attempts++;
      
      if (cookieCount > 0) {
        console.log(`🍪 Куки появились! Количество: ${cookieCount} (за ${attempts * 500}ms)`);
        break;
      } else if (attempts === maxAttempts) {
        console.log(`⏰ Максимум попыток достигнут, используем фиксированную задержку...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // ВТОРОЙ ЗАПРОС (должен быть 200)
    console.log('🎯 Повторяем запрос с установленными куками...');
    const response2 = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    const finalCookies = await page.cookies();
    console.log(`✅ ВТОРОЙ ЗАПРОС: ${response2.status()}`);
    console.log(`🍪 Финальное количество кук: ${finalCookies.length}`);
    
    // Показываем экономию времени
    const totalTime = Date.now() - startTime;
    const savedTime = 3000 - totalTime;
    if (savedTime > 0) {
      console.log(`⚡ ЭКОНОМИЯ ВРЕМЕНИ: ${savedTime}ms (было 3 сек фиксированно)`);
    }
    
  } else {
    console.log('🎉 ПЕРВЫЙ ЗАПРОС УСПЕШЕН! (редкий случай)');
  }
  
  await browser.close();
};

await optimizedWarmup();

console.log('\n🏁 Оптимизированный прогрев завершен!'); 