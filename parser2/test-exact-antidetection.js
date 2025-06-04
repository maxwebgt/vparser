import puppeteer from 'puppeteer';

console.log('🔥 ТЕСТ: Точная анти-детекция как в рабочем коде\n');

const testExactAntiDetection = async () => {
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
  
  // ТОЧНАЯ КОПИЯ заголовков
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
  
  const realistic_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
  await page.setUserAgent(realistic_user_agent);
  
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false
  });
  
  // 🎭 ТОЧНАЯ КОПИЯ АНТИ-ДЕТЕКЦИИ ИЗ РАБОЧЕГО КОДА
  await page.evaluateOnNewDocument(() => {
    // 🔥 [PLATFORM FIX] Критическое исправление platform detection
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
      configurable: true
    });
    
    // 🖥️ [SCREEN FIX] Реалистичные размеры экрана (НЕ headless!)
    Object.defineProperty(screen, 'width', { get: () => 1920, configurable: true });
    Object.defineProperty(screen, 'height', { get: () => 1080, configurable: true });
    Object.defineProperty(screen, 'availWidth', { get: () => 1920, configurable: true });
    Object.defineProperty(screen, 'availHeight', { get: () => 1040, configurable: true }); // Учитываем taskbar
    Object.defineProperty(screen, 'colorDepth', { get: () => 24, configurable: true });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24, configurable: true });
    
    // 🔥 [WEBDRIVER ELIMINATION] Полное удаление webdriver следов
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,  // НЕ undefined - именно false!
      configurable: true
    });
    delete navigator.__proto__.webdriver;
    
    // 🌍 [LANGUAGE FIX] Правильная русская локализация
    Object.defineProperty(navigator, 'language', {
      get: () => 'ru-RU',
      configurable: true
    });
    
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ru-RU', 'ru', 'en-US', 'en'],
      configurable: true
    });
    
    // 🔌 [PLUGINS SIMULATION] Имитация реальных плагинов
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const pluginArray = [];
        pluginArray.length = 5;
        pluginArray[Symbol.iterator] = Array.prototype[Symbol.iterator];
        return pluginArray;
      },
      configurable: true
    });
    
    // 🎨 [CHROME SIMULATION] Полная имитация Chrome API
    window.chrome = {
      runtime: {
        id: 'nmmhkkegccagdldgiimedpiccmgmieda',
        onMessage: {},
        onConnect: {},
        sendMessage: function() {},
        connect: function() {},
        getManifest: function() { 
          return {
            name: 'Chrome Extension',
            version: '1.0.0'
          }; 
        }
      },
      loadTimes: function() {
        return {
          requestTime: Date.now() / 1000,
          startLoadTime: Date.now() / 1000,
          commitLoadTime: Date.now() / 1000,
          finishDocumentLoadTime: Date.now() / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintTime: Date.now() / 1000,
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other',
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false,
          npnNegotiatedProtocol: 'unknown',
          wasAlternateProtocolAvailable: false,
          connectionInfo: 'http/1.1'
        };
      },
      csi: function() {
        return {
          startE: Date.now(),
          onloadT: Date.now(),
          pageT: Math.random() * 1000 + 1000,
          tran: Math.floor(Math.random() * 20) + 1
        };
      },
      app: {
        isInstalled: false,
        InstallState: {
          DISABLED: 'disabled',
          INSTALLED: 'installed',
          NOT_INSTALLED: 'not_installed'
        },
        RunningState: {
          CANNOT_RUN: 'cannot_run',
          READY_TO_RUN: 'ready_to_run',
          RUNNING: 'running'
        }
      }
    };
    
    // 🔧 [PERMISSIONS API] Реалистичная работа с разрешениями
    if (window.navigator.permissions) {
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    }
    
    // 🔇 [CONSOLE FILTER] Фильтрация подозрительных логов
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const message = args.join(' ');
      // Блокируем только технические ошибки, НЕ влияющие на UX
      if (!message.includes('WebGL') && 
          !message.includes('GroupMarkerNotSet') && 
          !message.includes('swiftshader') &&
          !message.includes('gpu/command_buffer') &&
          !message.includes('dbus') &&
          !message.includes('DevTools')) {
        originalConsoleError.apply(console, args);
      }
    };
    
    // 🕐 [TIMING ATTACKS] Защита от timing attacks
    const originalDateNow = Date.now;
    Date.now = function() {
      return originalDateNow() + Math.floor(Math.random() * 2);
    };
    
    // 🎯 [FINAL TOUCH] Удаляем automation indicators
    window.navigator.webdriver = false;
    delete window.navigator.webdriver;
    
    // Очищаем все automation следы из DOM
    if (document.documentElement) {
      document.documentElement.removeAttribute('webdriver');
    }
  });
  
  console.log('🧪 Тест с ТОЧНОЙ анти-детекцией + задержка как в рабочем коде...');
  
  // ТОЧНАЯ КОПИЯ логики задержки
  const initialDelay = Math.floor(Math.random() * 1000) + 500;
  console.log(`⏰ Начальная задержка: ${initialDelay}ms`);
  await new Promise(resolve => setTimeout(resolve, initialDelay));
  
  try {
    const response = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    console.log(`✅ РЕЗУЛЬТАТ: ${response.status()}`);
    
    if (response.status() === 403) {
      console.log(`🔄 Получили 403 - проверяем "прогрев"...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const retryResponse = await page.goto('https://www.vseinstrumenti.ru/', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      console.log(`✅ ПОСЛЕ ПРОГРЕВА: ${retryResponse.status()}`);
    }
    
  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

await testExactAntiDetection();

console.log('\n🏁 Тест с точной анти-детекцией завершен!'); 