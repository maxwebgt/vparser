import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function diagnosePageLoading() {
  console.log('\n🔍 === ДИАГНОСТИКА ЗАГРУЗКИ СТРАНИЦЫ ===\n');
  console.log(`📍 Платформа: ${process.platform}`);
  console.log(`📍 Node версия: ${process.version}`);
  console.log(`📍 Текущий пользователь: UID=${process.getuid ? process.getuid() : 'N/A'}`);
  console.log(`📍 Переменные окружения:`);
  console.log(`   DISPLAY: ${process.env.DISPLAY || 'не установлена'}`);
  console.log(`   DBUS_SESSION_BUS_ADDRESS: ${process.env.DBUS_SESSION_BUS_ADDRESS || 'не установлена'}`);
  console.log(`   XDG_RUNTIME_DIR: ${process.env.XDG_RUNTIME_DIR || 'не установлена'}`);
  
  const testUrl = 'https://www.vseinstrumenti.ru/product/diskovaya-pila-ryobi-one-r18cs-0-5133002338-727792/';
  
  // Минимальные аргументы для диагностики
  const minimalArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1920,1080'
  ];
  
  // Находим браузер
  let executablePath;
  if (process.platform === 'linux') {
    const paths = ['/usr/lib/chromium/chromium', '/usr/bin/chromium'];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }
  }
  
  console.log(`\n🌐 Запускаем браузер...`);
  console.log(`📍 Путь к браузеру: ${executablePath || 'автоматический'}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: minimalArgs,
    dumpio: true // Включаем все логи браузера
  });
  
  console.log(`✅ Браузер запущен\n`);
  
  try {
    const page = await browser.newPage();
    
    // Устанавливаем user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36');
    
    // Включаем логирование консоли браузера
    page.on('console', msg => {
      console.log(`🖥️ [Browser Console ${msg.type()}]: ${msg.text()}`);
    });
    
    // Логируем ошибки страницы
    page.on('pageerror', error => {
      console.log(`❌ [Page Error]: ${error.message}`);
    });
    
    // Логируем запросы
    let requestCount = 0;
    page.on('request', request => {
      requestCount++;
      if (requestCount <= 10) { // Первые 10 запросов
        console.log(`📤 [Request ${requestCount}]: ${request.method()} ${request.url().substring(0, 100)}...`);
      }
    });
    
    // Логируем ответы
    let responseCount = 0;
    page.on('response', response => {
      responseCount++;
      if (responseCount <= 10) { // Первые 10 ответов
        console.log(`📥 [Response ${responseCount}]: ${response.status()} ${response.url().substring(0, 100)}...`);
      }
    });
    
    console.log(`\n🔗 Переходим на: ${testUrl}\n`);
    
    const startTime = Date.now();
    const response = await page.goto(testUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    const loadTime = Date.now() - startTime;
    console.log(`\n⏱️ Время загрузки: ${loadTime}ms`);
    console.log(`📊 HTTP статус: ${response.status()}`);
    
    // Ждём немного для динамического контента
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Диагностическая информация
    console.log(`\n🔍 === ДИАГНОСТИКА СТРАНИЦЫ ===\n`);
    
    const diagnostics = await page.evaluate(() => {
      const data = {};
      
      // Базовая информация
      data.title = document.title;
      data.url = window.location.href;
      data.readyState = document.readyState;
      
      // Размер страницы
      data.htmlLength = document.documentElement.outerHTML.length;
      data.bodyText = document.body ? document.body.innerText.substring(0, 200) : 'NO BODY';
      
      // Проверка JavaScript
      data.jsEnabled = true; // Если этот код выполняется, JS работает
      
      // Проверка основных элементов
      data.h1Element = document.querySelector('h1') ? document.querySelector('h1').innerText : 'NO H1';
      data.hasProductTitle = !!document.querySelector('h1[data-qa="get-product-title"]');
      data.priceElement = document.querySelector('[data-qa="price-now"]') ? 
        document.querySelector('[data-qa="price-now"]').innerText : 'NO PRICE';
      
      // Проверка скриптов
      data.scriptCount = document.querySelectorAll('script').length;
      data.externalScripts = Array.from(document.querySelectorAll('script[src]'))
        .slice(0, 5)
        .map(s => s.src);
      
      // Проверка стилей
      data.styleSheetCount = document.styleSheets.length;
      
      // Проверка cookies
      data.cookies = document.cookie.substring(0, 100);
      
      return data;
    });
    
    console.log(`📄 Заголовок страницы: "${diagnostics.title}"`);
    console.log(`🔗 Финальный URL: ${diagnostics.url}`);
    console.log(`📊 Состояние документа: ${diagnostics.readyState}`);
    console.log(`📏 Размер HTML: ${(diagnostics.htmlLength / 1024).toFixed(2)} KB`);
    console.log(`✅ JavaScript работает: ${diagnostics.jsEnabled ? 'ДА' : 'НЕТ'}`);
    console.log(`\n📝 Начало текста страницы:\n${diagnostics.bodyText}\n`);
    console.log(`🏷️ H1 элемент: "${diagnostics.h1Element}"`);
    console.log(`🛒 Есть заголовок товара: ${diagnostics.hasProductTitle ? 'ДА' : 'НЕТ'}`);
    console.log(`💰 Цена: "${diagnostics.priceElement}"`);
    console.log(`📜 Количество скриптов: ${diagnostics.scriptCount}`);
    console.log(`🎨 Количество стилей: ${diagnostics.styleSheetCount}`);
    console.log(`🍪 Cookies: ${diagnostics.cookies || 'НЕТ'}`);
    
    if (diagnostics.externalScripts.length > 0) {
      console.log(`\n📦 Внешние скрипты (первые 5):`);
      diagnostics.externalScripts.forEach((src, i) => {
        console.log(`   ${i + 1}. ${src}`);
      });
    }
    
    // Сохраняем HTML для анализа
    const html = await page.content();
    const filename = `debug-page-${process.platform}-${Date.now()}.html`;
    fs.writeFileSync(path.join(__dirname, filename), html);
    console.log(`\n💾 HTML сохранён в: ${filename}`);
    
    // Делаем скриншот
    const screenshotName = `debug-screenshot-${process.platform}-${Date.now()}.png`;
    await page.screenshot({ 
      path: path.join(__dirname, screenshotName),
      fullPage: true 
    });
    console.log(`📸 Скриншот сохранён в: ${screenshotName}`);
    
  } catch (error) {
    console.error(`\n❌ ОШИБКА: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log(`\n✅ Браузер закрыт`);
  }
}

// Запускаем диагностику
diagnosePageLoading().catch(console.error); 