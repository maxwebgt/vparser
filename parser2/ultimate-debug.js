import puppeteer from 'puppeteer';
import fs from 'fs';

async function ultimateDebugAnalysis() {
  console.log('\n🚀 === ПОЛНЫЙ АНАЛИЗ ДЕТЕКЦИИ ===\n');
  
  // Определяем среду
  const isVDS = process.platform === 'linux' && !process.env.WSL_DISTRO_NAME;
  const environment = isVDS ? 'VDS_LINUX' : 'WINDOWS_DOCKER';
  
  console.log(`🖥️ Среда: ${environment}`);
  console.log(`📍 Platform: ${process.platform}`);
  console.log(`📍 Architecture: ${process.arch}`);
  console.log(`📍 Node.js: ${process.version}`);
  
  // Поиск браузера
  let executablePath = null;
  if (process.platform === 'linux') {
    const paths = ['/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser'];
    for (const path of paths) {
      if (fs.existsSync(path)) {
        executablePath = path;
        console.log(`🌐 Браузер найден: ${path}`);
        break;
      }
    }
  }
  
  const launchOptions = {
    headless: 'new',
    executablePath,
    dumpio: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--exclude-switch=enable-automation',
      '--window-size=1920,1080',
      '--disable-gpu'
    ]
  };
  
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  
  // Перехватываем ВСЕ исходящие запросы
  const allRequests = [];
  const allResponses = [];
  
  page.on('request', request => {
    allRequests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData()
    });
  });
  
  page.on('response', response => {
    allResponses.push({
      url: response.url(),
      status: response.status(),
      headers: response.headers()
    });
  });
  
  // Устанавливаем User-Agent как в основном коде
  const userAgent = isVDS ? 
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' :
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
  
  await page.setUserAgent(userAgent);
  
  // Устанавливаем заголовки как в основном коде
  const headers = isVDS ? {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  } : {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Chromium";v="136", "Not_A Brand";v="24", "Google Chrome";v="136"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'DNT': '1'
  };
  
  await page.setExtraHTTPHeaders(headers);
  
  // Применяем все наши анти-детекция скрипты
  await page.evaluateOnNewDocument(() => {
    // Platform fix
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
      configurable: true
    });
    
    // WebDriver elimination
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
    delete navigator.__proto__.webdriver;
    
    // Language fix
    Object.defineProperty(navigator, 'language', {
      get: () => 'ru-RU',
      configurable: true
    });
    
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ru-RU', 'ru', 'en-US', 'en'],
      configurable: true
    });
    
    // Chrome simulation
    window.chrome = {
      runtime: {
        id: 'nmmhkkegccagdldgiimedpiccmgmieda',
        onMessage: {},
        onConnect: {},
        sendMessage: function() {},
        connect: function() {}
      },
      loadTimes: function() {
        return {
          requestTime: Date.now() / 1000,
          startLoadTime: Date.now() / 1000,
          commitLoadTime: Date.now() / 1000
        };
      }
    };
    
    // Screen properties fix
    Object.defineProperty(screen, 'width', { get: () => 1920, configurable: true });
    Object.defineProperty(screen, 'height', { get: () => 1080, configurable: true });
    Object.defineProperty(screen, 'availWidth', { get: () => 1920, configurable: true });
    Object.defineProperty(screen, 'availHeight', { get: () => 1040, configurable: true });
  });
  
  console.log('\n📄 Переходим на всеинструменты...');
  
  try {
    await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Ждем загрузки страницы
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Получаем финальный URL и статус
    const finalUrl = page.url();
    const title = await page.title();
    
    console.log(`\n📊 === РЕЗУЛЬТАТ НАВИГАЦИИ ===`);
    console.log(`🎯 Финальный URL: ${finalUrl}`);
    console.log(`📄 Заголовок: ${title}`);
    
    // Проверяем на защиту
    const isProtected = finalUrl.includes('/xpvnsulc/') || 
                       title.includes('Проверка') ||
                       title.includes('Security') ||
                       title === 'ВсеИнструменты.ру';
    
    console.log(`🛡️ Защита обнаружена: ${isProtected ? '❌ ДА' : '✅ НЕТ'}`);
    
    // Собираем полный отпечаток браузера
    const fingerprint = await page.evaluate(() => {
      const fp = {};
      
      // Navigator properties
      fp.navigator = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        webdriver: navigator.webdriver,
        vendor: navigator.vendor,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        onLine: navigator.onLine
      };
      
      // Screen properties
      fp.screen = {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth
      };
      
      // WebGL fingerprint
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        if (gl) {
          fp.webgl = {
            vendor: gl.getParameter(gl.VENDOR),
            renderer: gl.getParameter(gl.RENDERER),
            version: gl.getParameter(gl.VERSION),
            unmaskedVendor: gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_VENDOR_WEBGL) || 'N/A',
            unmaskedRenderer: gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL) || 'N/A'
          };
        }
      } catch (e) {
        fp.webgl = { error: e.message };
      }
      
      // Canvas fingerprint
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Canvas test 🔍', 2, 2);
        fp.canvas = canvas.toDataURL();
      } catch (e) {
        fp.canvas = { error: e.message };
      }
      
      // Plugins
      fp.plugins = Array.from(navigator.plugins).map(p => ({
        name: p.name,
        filename: p.filename
      }));
      
      // Chrome object
      fp.chrome = {
        exists: !!window.chrome,
        loadTimes: typeof window.chrome?.loadTimes,
        runtime: !!window.chrome?.runtime
      };
      
      // Timezone
      fp.timezone = {
        offset: new Date().getTimezoneOffset(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      // Performance timing
      fp.performance = {
        navigationStart: performance.timing?.navigationStart,
        connectStart: performance.timing?.connectStart
      };
      
      return fp;
    });
    
    // Анализируем исходящие запросы
    const mainRequest = allRequests.find(r => r.url.includes('vseinstrumenti.ru'));
    const mainResponse = allResponses.find(r => r.url.includes('vseinstrumenti.ru'));
    
    console.log(`\n🔍 === АНАЛИЗ HTTP ЗАПРОСОВ ===`);
    console.log(`📤 Всего исходящих запросов: ${allRequests.length}`);
    console.log(`📥 Всего ответов: ${allResponses.length}`);
    
    if (mainRequest) {
      console.log(`\n📋 Основной запрос к vseinstrumenti.ru:`);
      console.log(`🌐 URL: ${mainRequest.url}`);
      console.log(`📄 Method: ${mainRequest.method}`);
      console.log(`📋 Headers:`);
      Object.entries(mainRequest.headers).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    if (mainResponse) {
      console.log(`\n📨 Ответ от vseinstrumenti.ru:`);
      console.log(`📊 Status: ${mainResponse.status}`);
      console.log(`📋 Response Headers:`);
      Object.entries(mainResponse.headers).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    console.log(`\n🔍 === ОТПЕЧАТОК БРАУЗЕРА ===`);
    console.log(`👤 User-Agent: ${fingerprint.navigator.userAgent}`);
    console.log(`🖥️ Platform: ${fingerprint.navigator.platform}`);
    console.log(`⚙️ Hardware Concurrency: ${fingerprint.navigator.hardwareConcurrency}`);
    console.log(`💾 Device Memory: ${fingerprint.navigator.deviceMemory}`);
    console.log(`🌐 Language: ${fingerprint.navigator.language}`);
    console.log(`🔍 WebDriver: ${fingerprint.navigator.webdriver}`);
    console.log(`🎨 WebGL Vendor: ${fingerprint.webgl?.vendor || 'N/A'}`);
    console.log(`🎮 WebGL Renderer: ${fingerprint.webgl?.renderer || 'N/A'}`);
    console.log(`🎮 WebGL Unmasked Vendor: ${fingerprint.webgl?.unmaskedVendor || 'N/A'}`);
    console.log(`🎮 WebGL Unmasked Renderer: ${fingerprint.webgl?.unmaskedRenderer || 'N/A'}`);
    console.log(`🖼️ Canvas Hash: ${fingerprint.canvas ? fingerprint.canvas.substring(0, 50) + '...' : 'N/A'}`);
    console.log(`🔌 Plugins: ${fingerprint.plugins.length}`);
    console.log(`⭐ Chrome Object: ${fingerprint.chrome.exists}`);
    console.log(`🌍 Timezone: ${fingerprint.timezone.timezone}`);
    
    // Сохраняем полный отчет
    const report = {
      environment,
      timestamp: new Date().toISOString(),
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        chromiumVersion: await browser.version()
      },
      navigation: {
        finalUrl,
        title,
        isProtected
      },
      fingerprint,
      requests: allRequests,
      responses: allResponses
    };
    
    const filename = `debug_report_${environment}_${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`\n💾 Полный отчет сохранен: ${filename}`);
    
    // КРИТИЧЕСКАЯ ДИАГНОСТИКА
    console.log(`\n🚨 === КРИТИЧЕСКАЯ ДИАГНОСТИКА ===`);
    
    if (isProtected) {
      console.log(`❌ ПРОБЛЕМА: Сайт активировал защиту!`);
      
      // Ищем подозрительные различия
      const suspiciousFindings = [];
      
      if (fingerprint.navigator.hardwareConcurrency !== 8 && fingerprint.navigator.hardwareConcurrency !== 4) {
        suspiciousFindings.push(`🔍 Подозрительное кол-во ядер: ${fingerprint.navigator.hardwareConcurrency}`);
      }
      
      if (!fingerprint.navigator.deviceMemory) {
        suspiciousFindings.push(`🔍 Device Memory недоступна`);
      }
      
      if (fingerprint.webgl?.vendor?.includes('Mesa') || fingerprint.webgl?.renderer?.includes('llvmpipe')) {
        suspiciousFindings.push(`🔍 Виртуализированная графика: ${fingerprint.webgl.renderer}`);
      }
      
      if (fingerprint.plugins.length === 0) {
        suspiciousFindings.push(`🔍 Нет плагинов`);
      }
      
      if (!fingerprint.chrome.exists) {
        suspiciousFindings.push(`🔍 Chrome object отсутствует`);
      }
      
      if (suspiciousFindings.length > 0) {
        console.log(`\n🚨 НАЙДЕНЫ ПОДОЗРИТЕЛЬНЫЕ ПРИЗНАКИ:`);
        suspiciousFindings.forEach(finding => console.log(finding));
      } else {
        console.log(`\n🤔 Подозрительных признаков не найдено, возможно детекция по другим параметрам...`);
      }
    } else {
      console.log(`✅ УСПЕХ: Защита НЕ активирована!`);
    }
    
  } catch (error) {
    console.log(`\n❌ ОШИБКА: ${error.message}`);
  } finally {
    await browser.close();
  }
}

// Запуск
ultimateDebugAnalysis().catch(console.error); 