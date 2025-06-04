import puppeteer from 'puppeteer';

console.log('🍪 ТЕСТ: С предустановленными куками (как реальный браузер)\n');

const testWithCookies = async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  // Применяем анти-детекцию
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
  });
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36');
  
  console.log('🍪 Устанавливаем предварительные куки...');
  
  // Устанавливаем базовые куки (как в реальном браузере)
  await page.setCookie(
    {
      name: '_ym_uid',
      value: `${Date.now()}${Math.floor(Math.random() * 1000000)}`,
      domain: '.vseinstrumenti.ru',
      path: '/',
      httpOnly: false,
      secure: false
    },
    {
      name: '_ym_d', 
      value: `${Date.now()}`,
      domain: '.vseinstrumenti.ru',
      path: '/',
      httpOnly: false,
      secure: false
    },
    {
      name: 'session_id',
      value: `sess_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      domain: '.vseinstrumenti.ru', 
      path: '/',
      httpOnly: true,
      secure: false
    }
  );
  
  console.log('💾 Устанавливаем localStorage...');
  
  // Предварительно переходим на домен чтобы установить localStorage
  await page.goto('https://www.vseinstrumenti.ru/favicon.ico');
  
  await page.evaluate(() => {
    // Имитируем что пользователь уже был на сайте
    localStorage.setItem('visited_before', 'true');
    localStorage.setItem('last_visit', Date.now().toString());
    localStorage.setItem('user_preferences', JSON.stringify({
      city: 'moscow',
      theme: 'light'
    }));
    
    // Имитируем Google Analytics
    localStorage.setItem('_ga', 'GA1.2.' + Math.floor(Math.random() * 1000000000) + '.' + Math.floor(Date.now() / 1000));
    localStorage.setItem('_gid', 'GA1.2.' + Math.floor(Math.random() * 1000000000) + '.' + Math.floor(Date.now() / 1000));
  });
  
  console.log('⏰ Ждем стабилизации (2 сек)...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('🎯 Основной запрос с куками и localStorage...');
  try {
    const response = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log(`✅ С КУКАМИ: ${response.status()}`);
    
    // Проверяем что установилось
    const cookies = await page.cookies();
    console.log(`🍪 Количество кук: ${cookies.length}`);
    
    const localStorage = await page.evaluate(() => {
      return Object.keys(window.localStorage).length;
    });
    console.log(`💾 Записей в localStorage: ${localStorage}`);
    
  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

await testWithCookies();

console.log('\n🏁 Тест с куками завершен!'); 