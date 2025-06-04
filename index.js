import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { saveHtmlForDebug, cleanupOldHtmlFiles } from '../../../utils/htmlDebugger.js';

// Webshare API configuration
const WEBSHARE_API_KEY = 'qf8qedpyxethbo8qjdhiol5r4js7lm8jmcs59pkf';

// 🔧 [CITY] Конфигурация города для правильной установки кук
const CITY_CONFIG = {
  enabled: true,
  representId: 1,  // ID нужного города
  representType: 'common'  // ← ИСПРАВЛЕНО: должно быть 'common', а не 'city'
};

// Proxy management state - from proxyManager.js
let proxies = [];
let currentProxyIndex = 0;
let proxyFailures = {};
let proxyUsageCounts = {};
let lastProxyFetch = 0;

// Проверяем, нужно ли пропустить city representation для данного URL
const shouldSkipCityRepresentation = (url) => {
  // Список URL патернов, для которых не нужно использовать city representation
  const skipPatterns = [
    '/xpvnsulc/', // защита от ботов
    'captcha',
    'security-check',
    'challenge'
  ];
  
  return skipPatterns.some(pattern => url.includes(pattern));
};

// Формируем специальную ссылку с city representation для правильной установки кук города
const transformUrlWithCityRepresentation = (originalUrl, cityId = CITY_CONFIG.representId) => {
  // Пропускаем city representation для проблемных URLs
  if (shouldSkipCityRepresentation(originalUrl)) {
    logDebug(`🏠 [CITY] Пропускаем city representation для URL с защитой: ${abbreviateUrl(originalUrl)}`);
    return originalUrl;
  }
  
  // Только для vseinstrumenti.ru URLs и если функция включена
  if (!originalUrl.includes('vseinstrumenti.ru') || !CITY_CONFIG.enabled) {
    logDebug(`🏠 [CITY] Пропускаем city representation: не vseinstrumenti.ru или отключено`);
    return originalUrl;
  }
  
  // Проверяем, нет ли уже representation параметров
  if (originalUrl.includes('represent/change')) {
    logDebug(`🏠 [CITY] URL уже содержит represent/change, используем как есть`);
    return originalUrl;
  }
  
  try {
    // Получаем домен (с протоколом)
    const urlObj = new URL(originalUrl);
    const domain = `${urlObj.protocol}//${urlObj.hostname}`;
    
    // Формируем новый URL с city representation
    const cityRepresentUrl = `${domain}/represent/change/?represent_id=${cityId}&represent_type=${CITY_CONFIG.representType}&url_to_redirect=${encodeURIComponent(originalUrl)}`;
    
    logDebug(`🏠 [CITY] === ФОРМИРОВАНИЕ CITY REPRESENTATION URL ===`);
    logDebug(`🏠 [CITY] Оригинальный URL: ${originalUrl}`);
    logDebug(`🏠 [CITY] Закодированный URL: ${encodeURIComponent(originalUrl)}`);
    logDebug(`🏠 [CITY] Город ID: ${cityId}, Тип: ${CITY_CONFIG.representType}`);
    logDebug(`🏠 [CITY] Итоговый represent URL: ${cityRepresentUrl}`);
    logDebug(`🏠 [CITY] ===============================================`);
    
    return cityRepresentUrl;
  } catch (error) {
    logDebug(`🏠 [CITY] Ошибка формирования city representation URL: ${error.message}`);
    return originalUrl;
  }
};

// Helper function to get a valid screenshot path that works on Windows and Linux
function getScreenshotPath(filename) {
  // Use the system temp directory which exists on all platforms
  const tempDir = os.tmpdir();
  const screenshotDir = path.join(tempDir, 'vsem-screenshots');
  
  // Create the screenshot directory if it doesn't exist
  try {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      logDebug(`Created screenshot directory: ${screenshotDir}`);
    }
  } catch (error) {
    logDebug(`Failed to create screenshot directory: ${error.message}`);
    // Fall back to temp dir if creating subdirectory fails
    return path.join(tempDir, filename);
  }
  
  return path.join(screenshotDir, filename);
}

// Function to extract product data from page - FAST and RELIABLE approach
const extractProductData = async (page, earlyPageTitle = null) => {
  try {
    logDebug('🚀 [EXTRACT] Starting FAST product data extraction');
    
    // *** ШАГ 1: БЫСТРАЯ ПРОВЕРКА НА ЗАЩИТУ/ОШИБКУ ***
    logDebug('📋 [EXTRACT] Шаг 1: Получаем заголовок страницы...');
    const pageTitle = earlyPageTitle || await page.evaluate(() => document.title);
    logDebug(`📄 [EXTRACT] Page title: "${pageTitle}"`);
    
    // Проверяем заголовок на индикаторы ошибок/защиты
    if (pageTitle) {
      logDebug('🔍 [EXTRACT] Проверяем заголовок на индикаторы ошибок...');
      const errorIndicators = [
        'Страница не найдена',
        'Page Not Found', 
        '404', '403', '500',
        'Ошибка', 'Error',
        'Forbidden', 'Доступ запрещен',
        'Captcha', 'Security Check',
        'DDoS Protection'
      ];
      
      for (const indicator of errorIndicators) {
        if (pageTitle.includes(indicator)) {
          logDebug(`❌ [EXTRACT] Найден индикатор ошибки: "${indicator}" в заголовке`);
          throw new Error(`🛡️ Защита/ошибка обнаружена в заголовке: "${pageTitle}"`);
        }
      }
      
      // Проверяем на общий заголовок сайта (редирект на главную)
      if (pageTitle.trim() === 'ВсеИнструменты.ру' || 
          pageTitle.includes('Главная - ВсеИнструменты.ру')) {
        logDebug(`🏠 [EXTRACT] Обнаружен редирект на главную страницу`);
        throw new Error(`🏠 Редирект на главную страницу: "${pageTitle}"`);
      }
      
      logDebug('✅ [EXTRACT] Заголовок прошел проверку на ошибки');
    }
    
    // *** ШАГ 2: БЫСТРОЕ ИЗВЛЕЧЕНИЕ ДАННЫХ С КОНКРЕТНЫМИ СЕЛЕКТОРАМИ ***
    logDebug('⚡ [EXTRACT] Шаг 2: Быстрое извлечение данных...');
    
    // Минимальное ожидание для загрузки контента
    logDebug('⏰ [EXTRACT] Ожидание загрузки контента (1000ms)...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    logDebug('✅ [EXTRACT] Ожидание завершено');
    
    logDebug('🔍 [EXTRACT] Выполняем page.evaluate() для извлечения данных...');
    const productData = await page.evaluate(() => {
      // Извлекаем все данные за один раз для максимальной скорости
      const data = {};
      
      // Добавляем информацию для отладки
      data.debugInfo = {};
      
      // Проверяем что document существует
      if (!document) {
        throw new Error('Document не доступен');
      }
      
      try {
        // 1. НАЗВАНИЕ - из заголовка H1 или title
        const h1Element = document.querySelector('h1[data-qa="get-product-title"]') ||
                          document.querySelector('h1.product__title') ||
                          document.querySelector('h1');
        
        if (h1Element && h1Element.textContent.trim()) {
          data.name = h1Element.textContent.trim();
        } else {
          // Fallback к title страницы
          const title = document.title;
          if (title && title.length > 10) {
            data.name = title
              .replace(/\s*-\s*ВсеИнструменты\.ру.*$/i, '')
              .replace(/\s*-\s*выгодная цена.*$/i, '')
              .replace(/\s*-\s*купить.*$/i, '')
              .trim();
          }
        }
        
        // 2. ЦЕНА - из meta-тега или DOM
        const priceMeta = document.querySelector('meta[itemprop="price"]');
        if (priceMeta && priceMeta.getAttribute('content')) {
          const priceValue = parseFloat(priceMeta.getAttribute('content'));
          if (!isNaN(priceValue) && priceValue > 0) {
            data.price = priceValue;
          }
        }
        
        // Fallback поиск цены в DOM
        if (!data.price) {
          const priceSelectors = [
            // Новые правильные селекторы для vseinstrumenti.ru
            '[data-qa="price-now"]',
            '[data-behavior="price-now"]',
            '.N2sK2A [data-qa="price-now"]',
            '.N2sK2A [data-behavior="price-now"]',
            '._typography_snzga_46._heading_snzga_7[data-qa="price-now"]',
            
            // Старые селекторы
            '[data-qa="product-price"] .typography',
            '[data-qa="product-price-current"]',
            '.current-price',
            '.price-current',
            '.price-value'
          ];
          
          for (const selector of priceSelectors) {
            const priceEl = document.querySelector(selector);
            if (priceEl) {
              // Получаем чистый текст, обрабатываем неразрывные пробелы
              let priceText = priceEl.textContent || priceEl.innerText || '';
              // Заменяем неразрывные пробелы (\u00A0) на обычные пробелы
              priceText = priceText.replace(/\u00A0/g, ' ');
              // Убираем лишние пробелы
              priceText = priceText.replace(/\s+/g, ' ').trim();
              
              console.log(`🔍 Checking price from "${selector}": "${priceText}"`);
              
              // Ищем числа в тексте (включая возможные пробелы)
              const priceMatch = priceText.match(/\d[\d\s\u00A0]*\d|\d+/);
              if (priceMatch) {
                const cleanedPrice = priceMatch[0].replace(/[\s\u00A0]+/g, '').replace(',', '.');
                const price = parseFloat(cleanedPrice);
                if (!isNaN(price) && price > 0) {
                  console.log(`✅ Found price: ${price}`);
                  data.price = price;
                  break;
                }
              }
            }
          }
        }
        
        // 3. ИЗОБРАЖЕНИЕ - основное изображение товара
        const imageSelectors = [
          '.product-page-image__img',
          '.product-img img',
          '.product-gallery__image',
          '[data-qa="product-image"] img'
        ];
        
        for (const selector of imageSelectors) {
          const imgEl = document.querySelector(selector);
          if (imgEl && imgEl.src) {
            data.imageUrl = imgEl.src;
            break;
          }
        }
        
        // Fallback к meta og:image
        if (!data.imageUrl) {
          const metaOg = document.querySelector('meta[property="og:image"]');
          if (metaOg) {
            data.imageUrl = metaOg.getAttribute('content');
          }
        }
        
        // 4. КОЛИЧЕСТВО/НАЛИЧИЕ - из кнопки "В корзину" и текста наличия
        let addToCartBtn = document.querySelector('[data-qa="product-add-to-cart-button"]') ||
                           document.querySelector('button[title="В корзину"]') ||
                           document.querySelector('.add-to-cart') ||
                           document.querySelector('.OnnEZB button') ||
                           document.querySelector('[class*="add-to-cart"]') ||
                           document.querySelector('[class*="buy-button"]') ||
                           document.querySelector('button[data-qa*="add-to-cart"]') ||
                           document.querySelector('button[data-qa*="buy"]');
        
        // Если не нашли специфичные селекторы, ищем по тексту кнопки
        if (!addToCartBtn) {
          const allButtons = document.querySelectorAll('button');
          for (const btn of allButtons) {
            const btnText = btn.textContent.toLowerCase().trim();
            if (btnText.includes('в корзину') || 
                btnText.includes('купить') || 
                btnText.includes('заказать') ||
                btnText.includes('добавить')) {
              addToCartBtn = btn;
              break;
            }
          }
        }
        
        // Сохраняем отладочную информацию
        data.debugInfo.addToCartBtn = !!addToCartBtn;
        
        // Добавляем информацию о всех найденных кнопках для отладки
        const allButtons = document.querySelectorAll('button');
        data.debugInfo.totalButtons = allButtons.length;
        data.debugInfo.buttonTexts = Array.from(allButtons)
          .slice(0, 10) // Берём первые 10 кнопок
          .map(btn => btn.textContent.trim().substring(0, 50));
        
        if (addToCartBtn) {
          data.debugInfo.btnDisabled = addToCartBtn.disabled;
          data.debugInfo.btnHasDisabledClass = addToCartBtn.classList.contains('disabled');
          data.debugInfo.btnText = addToCartBtn.textContent.trim();
          data.debugInfo.btnOuterHTML = addToCartBtn.outerHTML.substring(0, 200);
        }
        
        if (addToCartBtn && !addToCartBtn.disabled && !addToCartBtn.classList.contains('disabled')) {
          data.availability = 'in_stock';
          
          // Пытаемся найти точное количество
          const availabilityEl = document.querySelector('[data-qa="availability-info"]');
          if (availabilityEl) {
            const quantityText = availabilityEl.textContent;
            // Сохраняем текст наличия для отладки
            data.debugInfo.availabilityText = quantityText;
            
            // Проверяем различные форматы количества
            let quantity = null;
            
            // 1. Точное число: "351 шт"
            let exactMatch = quantityText.match(/(\d+)\s*шт/);
            if (exactMatch) {
              quantity = parseInt(exactMatch[1]);
            }
            
            // 2. Больше числа: "> 100 шт", "более 100 шт"
            if (!quantity) {
              let moreMatch = quantityText.match(/[>больше|более]\s*(\d+)\s*шт/i);
              if (moreMatch) {
                quantity = parseInt(moreMatch[1]); // Берём базовое число
              }
            }
            
            if (quantity !== null) {
              data.quantity = quantity;
            } else {
              // Если не можем парсить число - просто отмечаем как "в наличии"
              data.quantity = 1; // Минимальное количество для покупки
            }
          } else {
            data.quantity = 1; // По умолчанию
          }
        } else {
          data.availability = 'out_of_stock';
          data.quantity = 0;
        }
        
        return data;
        
      } catch (evalError) {
        throw new Error(`Ошибка в page.evaluate: ${evalError.message}`);
      }
    });
    
    logDebug('✅ [EXTRACT] page.evaluate() успешно выполнен');
    logDebug(`📊 [EXTRACT] Извлеченные данные: name="${productData.name}", price=${productData.price}, availability=${productData.availability}`);
    
    return productData;
    
  } catch (error) {
    logDebug(`❌ [EXTRACT] Ошибка в extractProductData: ${error.message}`);
    logDebug(`🔍 [EXTRACT] Stack trace: ${error.stack}`);
    throw error;
  }
};

// Add timestamp to debug logs
function logDebug(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Debug - ${message}`);
}

// Функция для проверки качества извлеченных данных
function isDataQualityGood(productData) {
  if (!productData) {
    logDebug('❌ Качество данных: отсутствуют данные');
    return false;
  }
  
  const { name, price, imageUrl, quantity } = productData;
  
  // Обязательные поля
  if (!name || name.length < 5) {
    logDebug(`❌ Качество данных: некорректное название "${name}"`);
    return false;
  }
  
  // Проверяем что название не является навигационным элементом или главной страницей
  const invalidNames = ['главная', 'home', 'каталог', 'catalog', 'меню', 'menu'];
  const isMainPageTitle = name.includes('ВсеИнструменты.ру - онлайн-гипермаркет') || 
                         name.includes('для профессионалов и бизнеса') ||
                         name === 'ВсеИнструменты.ру';
  
  if (invalidNames.some(invalid => name.toLowerCase().includes(invalid)) || isMainPageTitle) {
    logDebug(`❌ Качество данных: название является главной страницей или навигацией "${name}"`);
    return false;
  }
  
  // Желательно иметь хотя бы цену, изображение, или бренд
  const hasPrice = price && price > 0;
  const hasImage = (imageUrl && imageUrl.length > 10) || (productData.imageUrl && productData.imageUrl.length > 10);
  const hasQuantity = quantity !== null && quantity !== undefined;
  const hasBrand = productData.brand && productData.brand.length > 0;
  
  const scoreCount = [hasPrice, hasImage, hasQuantity, hasBrand].filter(Boolean).length;
  
  // *** УСИЛЕННЫЕ ТРЕБОВАНИЯ: Если мало данных, возможно мы на неправильной странице ***
  if (scoreCount >= 2) {
    logDebug(`✅ Качество данных: отличное (название + ${scoreCount} дополнительных полей)`);
    return true;
  } else if (scoreCount === 1) {
    logDebug(`⚠️ Качество данных: среднее (название + ${scoreCount} поле) - возможно редирект`);
    return false; // Теперь требуем минимум 2 поля
  } else {
    logDebug(`❌ Качество данных: плохое (только название) - вероятно редирект на главную`);
    return false;
  }
}

// Fetch proxies from Webshare.io API - corrected to handle the actual API response structure
async function fetchProxies() {
  try {
    logDebug('Fetching proxies from Webshare.io API...');
    
    const apiUrl = 'https://proxy.webshare.io/api/proxy/list/';
    
    logDebug(`API URL: ${apiUrl}`);
    logDebug(`API Key length: ${WEBSHARE_API_KEY ? WEBSHARE_API_KEY.length : 0} chars`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Token ${WEBSHARE_API_KEY}`
      }
    });
    
    if (!response.ok) {
      const errorMsg = `API responded with status ${response.status}`;
      const responseText = await response.text();
      logDebug(`Proxy API error: ${errorMsg}`);
      logDebug(`Response body: ${responseText.substring(0, 200)}...`);
      return [];
    }
    
    const data = await response.json();
    
    proxies = (data.results || []).map(proxy => {
      const port = proxy.ports && proxy.ports.http ? proxy.ports.http : 0;
      
      return {
        host: proxy.proxy_address || '',
        port: port,
        username: proxy.username || '',
        password: proxy.password || '',
        failed: false,
        lastUsed: null
      };
    });
    
    proxies = proxies.filter(p => p.host && p.port > 0 && p.username && p.password);
    
    logDebug(`Successfully fetched ${proxies.length} valid proxies from Webshare.io`);
    lastProxyFetch = Date.now();
    
    return proxies;
  } catch (error) {
    logDebug(`PROXY ERROR: ${error.message}`);
    logDebug(`Error stack: ${error.stack}`);
    return [];
  }
}

// Get next working proxy with better logging
async function getNextWorkingProxy() {
  logDebug('Getting next working proxy');
  
  if (proxies.length === 0) {
    await fetchProxies();
    if (proxies.length === 0) {
      logDebug('No proxies available');
      return null;
    }
  }
  
  let attempts = 0;
  const maxAttempts = proxies.length;
  
  while (attempts < maxAttempts) {
    if (currentProxyIndex >= proxies.length) {
      currentProxyIndex = 0;
    }
    
    const proxy = proxies[currentProxyIndex];
    currentProxyIndex++;
    attempts++;
    
    if (!proxy.failed) {
      proxy.lastUsed = Date.now();
      logDebug(`Selected proxy: ${proxy.host}:${proxy.port} with auth ${proxy.username}:***`);
      
      if (!proxy.host || !proxy.port || !proxy.username || !proxy.password) {
        logDebug(`Invalid proxy configuration: ${JSON.stringify({
          hasHost: !!proxy.host,
          hasPort: !!proxy.port,
          hasUsername: !!proxy.username,
          hasPassword: !!proxy.password
        })}`);
        proxy.failed = true;
        continue;
      }
      
      return proxy;
    }
  }
  
  logDebug('All proxies have failed, resetting failure status');
  proxies.forEach(proxy => {
    proxy.failed = false;
  });
  
  const firstProxy = proxies[0];
  if (firstProxy) {
    firstProxy.lastUsed = Date.now();
    logDebug(`Reset all proxies, using: ${firstProxy.host}:${firstProxy.port}`);
    return firstProxy;
  }
  
  logDebug('No valid proxies found even after reset');
  return null;
}

// Test if a proxy works with example.org
async function testProxy(proxy) {
  try {
    if (!proxy || !proxy.host || !proxy.port) {
      logDebug(`Invalid proxy configuration: ${JSON.stringify(proxy)}`);
      return false;
    }
    
    logDebug(`Testing proxy ${proxy.host}:${proxy.port}`);
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        `--proxy-server=${proxy.host}:${proxy.port}`
      ]
    });
    
    try {
      const page = await browser.newPage();
      
      await page.authenticate({
        username: proxy.username,
        password: proxy.password
      });
      
      logDebug(`Authenticated with proxy ${proxy.host}:${proxy.port}`);
      
      const response = await page.goto('https://example.org', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000  // Увеличиваем timeout для медленных прокси
      });
      
      const status = response.status();
      const isSuccess = status === 200;
      
      logDebug(`Proxy test ${isSuccess ? 'successful' : 'failed'}: ${proxy.host}:${proxy.port} (status: ${status})`);
      return isSuccess;
    } finally {
      await browser.close();
    }
  } catch (error) {
    logDebug(`Proxy test failed for ${proxy.host}:${proxy.port}: ${error.message}`);
    markProxyAsFailed(proxy);
    return false;
  }
}

// Mark a proxy as failed
function markProxyAsFailed(proxy) {
  if (!proxy) return;
  
  proxy.failed = true;
  logDebug(`Marked proxy ${proxy.host}:${proxy.port} as failed`);
}

// Function to check if page has protection - improved with smarter detection
function hasProtection(currentUrl, pageTitle, content) {
  // Modified to remove URL from debug output
  logDebug(`Protection check details: Title="${pageTitle}", Content length=${content ? content.length : 0}`);
  
  // *** ПРИОРИТЕТНАЯ ПРОВЕРКА: URL редирект на защиту ***
  // Проверяем URL на известные паттерны защиты ПЕРВЫМ делом
  if (currentUrl) {
    const protectionUrlIndicators =
      currentUrl.includes('/xpvnsulc/') ||
      currentUrl.includes('captcha') || 
      currentUrl.includes('security-check') ||
      currentUrl.includes('challenge') ||
      currentUrl.includes('ddos') ||
      currentUrl.includes('cloudflare') ||
      currentUrl.includes('cf_chl') ||
      currentUrl.includes('back_location=') ||
      currentUrl.includes('hcheck=') ||
      currentUrl.includes('request_ip=') ||
      currentUrl.includes('oirutpspid=');
    
    if (protectionUrlIndicators) {
      logDebug(`Защита/Captcha обнаружена в URL: ${currentUrl.substring(0, 100)}...`);
      return true;
    }
  }
  
  // Check for empty or suspiciously short page title - common in protection scenarios
  const emptyOrShortTitle = !pageTitle || pageTitle.trim() === '' || pageTitle.length < 3;
  if (emptyOrShortTitle) {
    logDebug('Protection suspected: Empty or very short page title');
    return true;
  }
  
  // *** УСИЛЕННАЯ ПРОВЕРКА: Проверяем на страницы ошибок (404, 403, 500 и т.д.) ***
  const errorPageIndicators = 
    pageTitle && (
      pageTitle.includes('Страница не найдена') ||
      pageTitle.includes('Page Not Found') ||
      pageTitle.includes('404') ||
      pageTitle.includes('403') ||
      pageTitle.includes('500') ||
      pageTitle.includes('Ошибка') ||
      pageTitle.includes('Error') ||
      pageTitle.includes('Forbidden') ||
      pageTitle.includes('Доступ запрещен') ||
      pageTitle.includes('Товар не найден') ||
      pageTitle.includes('Product not found') ||
      pageTitle.includes('Недоступен') ||
      pageTitle.includes('Unavailable') ||
      // Добавляем проверки для пустых заголовков, которые могут загружаться динамически
      pageTitle.trim() === 'ВсеИнструменты.ру' || // только название сайта = ошибка
      pageTitle.includes('Главная - ВсеИнструменты.ру') // редирект на главную
    );
  
  if (errorPageIndicators) {
    logDebug(`Страница ошибки обнаружена в заголовке: "${pageTitle}"`);
    return true;
  }
  
  // Check for protection indicators in title (more reliable indicator)
  const protectionTitleIndicators = 
    pageTitle && (
      pageTitle.includes('Captcha') || 
      pageTitle.includes('Security Check') || 
      pageTitle.includes('Access Denied') ||
      pageTitle.includes('Robot') ||
      pageTitle.includes('Проверка') ||
      pageTitle.includes('Защита') ||
      pageTitle.includes('DDoS') ||
      pageTitle.includes('Cloudflare')
    );
  
  if (protectionTitleIndicators) {
    logDebug(`Protection found in title: "${pageTitle}"`);
    return true;
  }
  
  // Check for protection in URL (also reliable)
  const protectionUrlIndicators =
    currentUrl && (
      currentUrl.includes('captcha') || 
      currentUrl.includes('security-check') ||
      currentUrl.includes('challenge') ||
      currentUrl.includes('/xpvnsulc/') ||
      currentUrl.includes('ddos') ||
      currentUrl.includes('cloudflare') ||
      currentUrl.includes('cf_chl')
    );
  
  if (protectionUrlIndicators) {
    logDebug(`Protection found in URL: ${currentUrl}`);
    return true;
  }
  
  // For content, we need to be much more careful - look for ACTIVE captcha elements
  // rather than just the word appearing somewhere in scripts or comments
  if (content) {
    // *** УСИЛЕННАЯ ПРОВЕРКА: Проверяем контент на наличие индикаторов страниц ошибок ***
    // Используем только очень специфичные фразы, которые точно указывают на ошибку
    // и исключаем общие слова типа "Unavailable", которые могут встречаться в JS коде
    const errorContentPatterns = [
      'К сожалению, запрашиваемая вами страница не найдена', // Точная фраза с сайта
      'К сожалению, запрашиваемая вами страница',
      'запрашиваемая вами страница не найдена',
      'страница не найдена :(',
      'Страница не найдена',
      'Page not found',
      'Товар не найден',
      'Product not found',
      'Ошибка 404',
      'Error 404',
      'HTTP 404',
      'Доступ запрещен',
      'Access denied',
      'Forbidden',
      'Сервер не может найти',
      'Server cannot find',
      'Запрашиваемая страница не существует',
      'The requested page does not exist'
      // Убираем "Unavailable" и "Недоступна" из-за false positive в JS коде
    ];
    
    // Проверяем на наличие индикаторов страниц ошибок в контенте
    let errorIndicatorCount = 0;
    for (const pattern of errorContentPatterns) {
      if (content.toLowerCase().includes(pattern.toLowerCase())) {
        errorIndicatorCount++;
        logDebug(`Индикатор страницы ошибки найден в контенте: "${pattern}"`);
      }
    }
    
    // Для этого конкретного сайта даже 1 индикатор должен быть достаточным
    // потому что точные фразы вроде "К сожалению, запрашиваемая вами страница не найдена" 
    // встречаются только на страницах ошибок
    if (errorIndicatorCount >= 1) {
      // Дополнительная проверка: убеждаемся что нет явных элементов продукта
      const hasObviousProductElements = 
        content.includes('data-qa="get-product-title"') ||
        content.includes('data-qa="product-price"') ||
        content.includes('data-qa="product-add-to-cart-button"') ||
        content.includes('product__title') ||
        content.includes('add-to-cart');
      
      if (!hasObviousProductElements) {
        logDebug(`Обнаружено ${errorIndicatorCount} индикаторов страницы ошибки без элементов продукта`);
        return true;
      } else {
        logDebug(`Найдены индикаторы ошибки, но также есть элементы продукта - вероятно false positive`);
      }
    }
    
    // These patterns indicate an ACTIVE captcha/challenge is present
    const activeProtectionPatterns = [
      '<div class="captcha"', 
      '<div id="captcha"',
      'class="g-recaptcha"',
      'data-sitekey="',
      'hcaptcha',
      '<iframe[^>]*recaptcha',
      'cf-challenge',
      'cloudflare-challenge',
      'waiting-room',
      'ddos-protection'
    ];
    
    // Check for active protection elements
    for (const pattern of activeProtectionPatterns) {
      if (content.includes(pattern)) {
        logDebug(`Active protection element found in content: "${pattern}"`);
        return true;
      }
    }
    
    // If we have product details, it's almost certainly NOT a protection page
    const hasProductDetails = 
      content.includes('product-price') || 
      content.includes('add-to-cart') || 
      (pageTitle && pageTitle.includes('купить'));
    
    // If we detect "captcha" but also have product details, it's likely a false positive
    if (content.toLowerCase().includes('captcha') && hasProductDetails) {
      logDebug('Found "captcha" in content but page has product details - likely false positive');
      return false;
    }
  }
  
  return false; // Default to no protection if none of the checks triggered
}

// Helper function to abbreviate URLs in logs - only for protection URLs
function abbreviateUrl(url) {
  try {
    // If URL is too long or contains known protection patterns, abbreviate it
    if (!url) return 'undefined-url';
    
    // Check for known protection patterns
    if (url.includes('/xpvnsulc/') || 
        url.includes('hcheck=') || 
        url.includes('challenge') ||
        url.includes('captcha') || 
        url.includes('security-check') ||
        url.includes('cloudflare') ||
        url.includes('oirutps')) {
      // Extract just the domain and path, omit query string
      try {
        const urlObj = new URL(url);
        return `${urlObj.origin}${urlObj.pathname} [protection params omitted]`;
      } catch (e) {
        return '[Protection URL detected]';
      }
    }
    
    // Return full URL without truncation
    return url;
  } catch (e) {
    return '[Invalid URL format]';
  }
}

// Function to attempt scraping with or without proxy
async function attemptScrape(link, proxy = null, attemptNumber = 1) {
  // Добавляем детальное логирование для диагностики Docker + Puppeteer
  logDebug(`🚀 [attemptScrape] Начинаем попытку #${attemptNumber} для: ${abbreviateUrl(link)}`);
  logDebug(`🔧 [attemptScrape] Прокси: ${proxy ? `${proxy.host}:${proxy.port}` : 'Нет'}`);
  
  // 🔧 [FIX] Объявляем startTime в начале функции для доступности в catch блоке
  const functionStartTime = Date.now();
  let startTime = functionStartTime; // Будет перезаписан позже для навигации
  
  // Проверяем доступность исполняемого файла Chromium
  // В Debian/Ubuntu chromium - это wrapper, реальный бинарник в другом месте
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/lib/chromium/chromium',
    '/usr/lib/chromium-browser/chromium-browser',
    '/snap/bin/chromium'
  ].filter(Boolean);
  
  let executablePath = null;
  for (const path of possiblePaths) {
    try {
      const fs = require('fs');
      if (fs.existsSync(path)) {
        const stats = fs.statSync(path);
        // Проверяем что это реальный исполняемый файл, а не симлинк размером 0
        if (stats.size > 1000000) { // Chromium должен быть больше 1MB
          executablePath = path;
          logDebug(`✅ [Chromium] Найден исполняемый файл: ${path} (${Math.round(stats.size / 1024 / 1024)} MB)`);
          break;
        }
      }
    } catch (e) {
      // Игнорируем ошибки проверки
    }
  }
  
  if (!executablePath) {
    executablePath = '/usr/bin/chromium'; // Fallback
    logDebug(`⚠️ [Chromium] Используем fallback путь: ${executablePath}`);
  }
  
  // Проверяем системную информацию
  try {
    const fs = require('fs');
    const os = require('os');
    
    logDebug(`💻 [System] OS: ${os.platform()} ${os.release()}, Arch: ${os.arch()}`);
    logDebug(`💾 [System] Память: ${Math.round(os.totalmem() / 1024 / 1024)} MB, Свободно: ${Math.round(os.freemem() / 1024 / 1024)} MB`);
    
    if (fs.existsSync(executablePath)) {
      const stats = fs.statSync(executablePath);
      logDebug(`✅ [Chromium] Файл существует, размер: ${Math.round(stats.size / 1024 / 1024)} MB, права: ${stats.mode.toString(8)}`);
    } else {
      logDebug(`❌ [Chromium] Файл НЕ существует: ${executablePath}`);
    }
    
    // Проверяем /dev/shm (shared memory)
    if (fs.existsSync('/dev/shm')) {
      const shmStats = fs.statSync('/dev/shm');
      logDebug(`📁 [System] /dev/shm существует, права: ${shmStats.mode.toString(8)}`);
      
      // Проверяем размер shared memory
      try {
        const { exec } = require('child_process');
        exec('df -h /dev/shm', (error, stdout, stderr) => {
          if (!error && stdout) {
            logDebug(`💾 [System] Shared memory: ${stdout.trim().split('\n')[1]}`);
          }
        });
      } catch (e) {
        logDebug(`⚠️ [System] Не удалось проверить размер /dev/shm: ${e.message}`);
      }
    } else {
      logDebug(`❌ [System] /dev/shm НЕ существует`);
    }
  } catch (e) {
    logDebug(`⚠️ [System] Ошибка проверки системы: ${e.message}`);
  }

  // 🚀 [PROFESSIONAL ANTI-DETECTION] Профессиональная анти-детекция система
  const launchOptions = { 
    headless: 'new',
    executablePath: executablePath,
    dumpio: true,  // Включаем вывод логов от процесса Chromium для диагностики
    args: [
      // 🔥 [CORE SECURITY] Основные флаги безопасности
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      
      // 🎭 [ANTI-DETECTION] Критичные флаги для обхода детекции
      '--disable-blink-features=AutomationControlled',
      '--exclude-switch=enable-automation',
      '--disable-extensions-file-access-check',
      '--disable-extensions-http-throttling',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-background-timer-throttling',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-features=TranslateUI,VizDisplayCompositor',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-web-security',
      '--metrics-recording-only',
      '--no-first-run',
      '--no-default-browser-check',
      '--password-store=basic',
      '--use-mock-keychain',
      
      // 🖥️ [REALISTIC DISPLAY] Реалистичные настройки дисплея
      '--window-size=1920,1080',
      '--force-device-scale-factor=1',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-software-rasterizer',
      
      // 🔇 [SILENCE ERRORS] Подавление ошибок (но не влияющих на детекцию)
      '--disable-dbus',
      '--disable-logging',
      '--silent-debugger-extension-api',
      '--disable-extensions-except',
      
      // 🌍 [LANGUAGE & LOCALE] Правильная локализация  
      '--lang=ru-RU,ru',
      '--accept-lang=ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
    ],
    
    // 🖥️ [REALISTIC VIEWPORT] Реалистичный viewport (НЕ headless признаки!)
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false
    }
  };
  
  logDebug(`⚙️ [ANTI-DETECTION] Опции запуска с профессиональной анти-детекцией`);
  logDebug(`🔧 [ANTI-DETECTION] Количество флагов: ${launchOptions.args.length}`);
  
  if (proxy) {
    launchOptions.args.push(`--proxy-server=${proxy.host}:${proxy.port}`);
    logDebug(`🌐 [Proxy] Добавлен прокси-сервер: ${proxy.host}:${proxy.port}`);
  }
  
  logDebug(`🔄 [Puppeteer] Запускаем браузер с анти-детекцией...`);
  const browserStartTime = Date.now();
  
  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
    const browserLaunchTime = Date.now() - browserStartTime;
    logDebug(`✅ [Puppeteer] Браузер успешно запущен за ${browserLaunchTime}ms`);
    
    // Проверяем версию браузера
    const browserVersion = await browser.version();
    logDebug(`🔍 [Browser] Версия: ${browserVersion}`);
    
  } catch (launchError) {
    logDebug(`❌ [Puppeteer] ОШИБКА запуска браузера: ${launchError.message}`);
    logDebug(`🔍 [Error] Stack trace: ${launchError.stack}`);
    throw launchError;
  }
  
  try {
    logDebug(`📄 [Page] Создаем новую страницу...`);
    const pageStartTime = Date.now();
    const page = await browser.newPage();
    const pageCreateTime = Date.now() - pageStartTime;
    logDebug(`✅ [Page] Страница создана за ${pageCreateTime}ms`);
    
    if (proxy) {
      logDebug(`🔐 [Proxy] Настраиваем аутентификацию...`);
      await page.authenticate({
        username: proxy.username,
        password: proxy.password
      });
      logDebug(`✅ [Proxy] Аутентификация настроена`);
    }
    
    // 🚀 [CRITICAL] ПРОФЕССИОНАЛЬНАЯ АНТИ-ДЕТЕКЦИЯ - ДОЛЖНА БЫТЬ ПЕРВОЙ!
    logDebug(`🎭 [ANTI-DETECTION] Настраиваем профессиональную анти-детекцию...`);
    
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
    
    logDebug(`✅ [ANTI-DETECTION] Профессиональная анти-детекция настроена!`);
    
    // 🔧 [USER-AGENT] Точно соответствующий User-Agent
    logDebug(`🌐 [UserAgent] Устанавливаем реалистичный User-Agent...`);
    const realistic_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
    await page.setUserAgent(realistic_user_agent);
    
    // 🖥️ [VIEWPORT] Реалистичный viewport
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false
    });
    
    // 📋 [HEADERS] Критически важные заголовки (ИСПРАВЛЯЕМ ПУСТЫЕ ЗАГОЛОВКИ!)
    logDebug(`📋 [Headers] Устанавливаем профессиональные HTTP заголовки...`);
    
    const professionalHeaders = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="136", "Not_A Brand";v="24", "Google Chrome";v="136"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',  // 🔥 КРИТИЧНО: Windows, НЕ Linux!
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'DNT': '1'  // Do Not Track для реалистичности
    };
    
    await page.setExtraHTTPHeaders(professionalHeaders);
    logDebug(`✅ [Headers] Установлено ${Object.keys(professionalHeaders).length} профессиональных заголовков`);
    
    // 🚀 [3-STAGE NAVIGATION] Трехэтапная навигация для vseinstrumenti.ru
    let targetUrl = link; // По умолчанию используем прямую ссылку
    
    if (link.includes('vseinstrumenti.ru')) {
      logDebug(`🚀 [3-STAGE] === ТРЕХЭТАПНАЯ НАВИГАЦИЯ ===`);
      
      try {
        // 🏠 [STAGE 1/3] ГЛАВНАЯ СТРАНИЦА
        logDebug(`🏠 [STAGE 1/3] Загружаем главную страницу...`);
        
        const initialDelay = Math.floor(Math.random() * 1000) + 500;
        logDebug(`⏰ [STAGE 1/3] Начальная задержка: ${initialDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, initialDelay));
        
        const homePageStart = Date.now();
        const homeResponse = await page.goto('https://www.vseinstrumenti.ru/', { 
          waitUntil: 'domcontentloaded',
          timeout: 45000
        });
        
        const homeStatus = homeResponse ? homeResponse.status() : 'unknown';
        logDebug(`✅ [STAGE 1/3] Главная загружена за ${Date.now() - homePageStart}ms, статус: ${homeStatus}`);
        
        if (homeStatus === 403) {
          logDebug(`❌ [STAGE 1/3] Главная заблокирована: HTTP 403`);
        } else {
          logDebug(`🎉 [STAGE 1/3] Главная загрузилась успешно!`);
        }
        
        // Имитируем просмотр главной
        await new Promise(resolve => setTimeout(resolve, 1500));
        await page.mouse.move(500, 300);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // 🏙️ [STAGE 2/3] УСТАНОВКА ГОРОДА
        logDebug(`🏙️ [STAGE 2/3] Устанавливаем город ID=${CITY_CONFIG.representId}...`);
        
        const citySetupStart = Date.now();
        const cityUrl = `https://www.vseinstrumenti.ru/represent/change/?represent_id=${CITY_CONFIG.representId}`;
        logDebug(`🏙️ [STAGE 2/3] URL установки города: ${cityUrl}`);
        
        const cityResponse = await page.goto(cityUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        const cityStatus = cityResponse ? cityResponse.status() : 'unknown';
        const cityFinalUrl = page.url();
        logDebug(`✅ [STAGE 2/3] Город установлен за ${Date.now() - citySetupStart}ms, статус: ${cityStatus}`);
        logDebug(`🔍 [STAGE 2/3] Финальный URL: ${abbreviateUrl(cityFinalUrl)}`);
        
        // Ждем установки кук
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 🛒 [STAGE 3/3] НАСТРОЙКА ДЛЯ ТОВАРА
        logDebug(`🛒 [STAGE 3/3] Настраиваем заголовки для товара...`);
        
        // Устанавливаем правильные заголовки для товара
        await page.setExtraHTTPHeaders({
          ...professionalHeaders,
          'Sec-Fetch-Site': 'same-origin',
          'Referer': cityFinalUrl
        });
        
        logDebug(`✅ [3-STAGE] Трехэтапная навигация завершена успешно!`);
        
        // targetUrl остается link (прямая ссылка на товар)
        
      } catch (error) {
        logDebug(`⚠️ [3-STAGE] Ошибка трехэтапной навигации: ${error.message}`);
        logDebug(`🔄 [3-STAGE] Fallback к обычной навигации...`);
        // targetUrl остается link
      }
    } else {
      // 🌍 [OTHER SITES] Для других сайтов - обычная навигация
      logDebug(`🌍 [OTHER SITES] Обычная навигация для внешнего сайта`);
    }
    
    logDebug(`🔗 [Navigation] Переходим на целевую страницу: ${abbreviateUrl(targetUrl)}`);
    
    startTime = Date.now();
    
    // ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ для сравнения с локальными запросами
    logDebug(`🔍 [DEBUG] === ДЕТАЛЬНАЯ ДИАГНОСТИКА ЗАПРОСА ===`);
    logDebug(`🌐 [DEBUG] Оригинальный URL: ${link}`);
    logDebug(`🌐 [DEBUG] Целевой URL (с city representation): ${targetUrl}`);
    
    // Логируем текущие заголовки
    const currentHeaders = await page.extraHTTPHeaders || {};
    logDebug(`📋 [DEBUG] Заголовки запроса: ${JSON.stringify(currentHeaders, null, 2)}`);
    
    // Логируем User-Agent
    const userAgent = await page.evaluate(() => navigator.userAgent);
    logDebug(`🕵️ [DEBUG] User-Agent: ${userAgent}`);
    
    // Логируем системную информацию
    const sysInfo = await page.evaluate(() => ({
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
      cookieEnabled: navigator.cookieEnabled,
      webdriver: navigator.webdriver,
      plugins: navigator.plugins.length,
      screen: { width: screen.width, height: screen.height },
      viewport: { width: window.innerWidth, height: window.innerHeight }
    }));
    logDebug(`💻 [DEBUG] Navigator info: ${JSON.stringify(sysInfo, null, 2)}`);
    
    const response = await page.goto(targetUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 90000 
    });
    
    // 🔍 [FINAL CHECK] Проверяем финальный URL после навигации
    const finalUrl = page.url();
    logDebug(`🔍 [FINAL] Финальный URL: ${abbreviateUrl(finalUrl)}`);
    logDebug(`🔍 [FINAL] Ожидали товар, получили: ${finalUrl.includes('/product/') ? 'ТОВАР ✅' : 'НЕ ТОВАР ❌'}`);
    
    // Для vseinstrumenti.ru проверяем что мы на странице товара
    if (link.includes('vseinstrumenti.ru') && !finalUrl.includes('/product/')) {
      logDebug(`⚠️  [FINAL] ПРОБЛЕМА: Финальный URL не содержит /product/!`);
      logDebug(`🔗 [FINAL] Исходный URL: ${abbreviateUrl(link)}`);
      logDebug(`🔗 [FINAL] Целевой URL: ${abbreviateUrl(targetUrl)}`);
      logDebug(`🔗 [FINAL] Финальный URL: ${abbreviateUrl(finalUrl)}`);
    }
    
    const navigationTime = Date.now() - startTime;
    logDebug(`✅ [Navigation] Переход выполнен за ${navigationTime}ms`);
    logDebug(`📊 [HTTP] Статус: ${response.status()}`);
    
    if (response.status() !== 200) {
      logDebug(`❌ [HTTP] Страница ошибки: HTTP ${response.status()}`);
    } else {
      logDebug(`✅ [HTTP] Успешная загрузка страницы`);
    }
    
    // *** НОВАЯ ПРОВЕРКА: Проверяем HTTP статус-код ***
    const statusCode = response ? response.status() : null;
    if (statusCode) {
      logDebug(`📊 [HTTP] Статус: ${statusCode}`);
      
      // Проверяем на ошибочные статус-коды
      if (statusCode >= 400) {
        logDebug(`❌ [HTTP] Страница ошибки: HTTP ${statusCode}`);
        return { 
          success: false, 
          protectionDetected: true, 
          error: `HTTP ${statusCode} - страница недоступна` 
        };
      }
    }
    
    let currentUrl = '';
    let pageTitle = '';
    let earlyPageTitle = '';
    let protectionDetected = false;
    let pageContent = '';
    
    try {
      currentUrl = page.url();
      logDebug(`Current URL: ${abbreviateUrl(currentUrl)}`);
    } catch (error) {
      logDebug(`Error getting current URL: ${error.message}`);
    }
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      pageTitle = await page.title();
      logDebug(`Full Page title: "${pageTitle}"`);
      
      pageContent = await page.content();
      logDebug(`Page content length: ${pageContent.length} bytes`);
    } catch (error) {
      logDebug(`Error getting page info: ${error.message}`);
    }
    
    // *** РАННЯЯ БЫСТРАЯ ДИАГНОСТИКА (ДО ИЗМЕНЕНИЯ JAVASCRIPT) ***
    logDebug('🔍 Выполняем РАННЮЮ диагностику страницы (до изменения JS)...');
    
    try {
      const earlyDiagnostic = await page.evaluate(() => {
        const title = document.title;
        const hasProductElements = !!document.querySelector('h1[data-qa="get-product-title"]') ||
                                    !!document.querySelector('[data-qa="product-price"]') ||
                                    !!document.querySelector('[data-qa="product-add-to-cart-button"]') ||
                                    !!document.querySelector('.product__title') ||
                                    !!document.querySelector('[itemprop="name"]');
        
        const hasErrorIndicators = title.toLowerCase().includes('страница не найдена') ||
                                   title.toLowerCase().includes('page not found') ||
                                   title.toLowerCase().includes('404') ||
                                   title.toLowerCase().includes('ошибка') ||
                                   document.body.innerText.toLowerCase().includes('к сожалению, запрашиваемая вами страница не найдена');
        
        // *** НОВАЯ ПРОВЕРКА: Детекция редиректов на главную/региональные страницы ***
        const bodyText = document.body ? document.body.innerText : '';
        const hasRedirectIndicators = 
          // Проверяем заголовок на редирект на главную
          title === 'ВсеИнструменты.ру' ||
          title.includes('Главная - ВсеИнструменты.ру') ||
          title.includes('Выберите город') ||
          title.includes('Choose your city') ||
          title.includes('ВсеИнструменты.ру - онлайн-гипермаркет') ||
          title.includes('для профессионалов и бизнеса') ||
          
          // Проверяем текст страницы на региональные индикаторы
          bodyText.includes('Выберите ваш город') ||
          bodyText.includes('Екатеринбург') && bodyText.includes('Москва') && bodyText.includes('Санкт-Петербург') ||
          (bodyText.includes('Каталог товаров') && !hasProductElements);
        
        // Проверяем кнопки навигации (если много таких кнопок - это не страница товара)
        const buttons = Array.from(document.querySelectorAll('button'));
        const navButtonTexts = buttons.map(btn => btn.textContent.trim().toLowerCase());
        const navKeywords = ['о нас', 'каталог', 'главная', 'контакты', 'акции', 'войти', 'регистрация'];
        const navButtonCount = navKeywords.filter(keyword => 
          navButtonTexts.some(btnText => btnText.includes(keyword))
        ).length;
        
        const hasNavigation = navButtonCount >= 3; // Если 3+ навигационных кнопки - это не товар
        
        return {
          title,
          hasProductElements,
          hasErrorIndicators,
          hasRedirectIndicators,
          hasNavigation,
          navButtonCount,
          bodyLength: document.body ? document.body.innerText.length : 0,
          buttonTexts: navButtonTexts.slice(0, 10) // Первые 10 кнопок для отладки
        };
      });
      
      // Сохраняем заголовок из ранней диагностики
      earlyPageTitle = earlyDiagnostic.title;
      
      logDebug(`📊 РАННЯЯ диагностика: заголовок="${earlyDiagnostic.title}", элементы продукта=${earlyDiagnostic.hasProductElements}, индикаторы ошибок=${earlyDiagnostic.hasErrorIndicators}, редирект=${earlyDiagnostic.hasRedirectIndicators}, навигация=${earlyDiagnostic.hasNavigation} (${earlyDiagnostic.navButtonCount} кнопок)`);
      
      // Если есть явные индикаторы ошибок И нет элементов продукта - это точно ошибка
      if (earlyDiagnostic.hasErrorIndicators && !earlyDiagnostic.hasProductElements) {
        logDebug(`❌ РАННЯЯ ЗАЩИТА: Обнаружена страница ошибки "${earlyDiagnostic.title}"`);
        return { success: false, protectionDetected: true, error: 'Early error page detection' };
      }
      
      // *** НОВАЯ ПРОВЕРКА: Детекция редиректа на главную/региональную страницу ***
      if ((earlyDiagnostic.hasRedirectIndicators || earlyDiagnostic.hasNavigation) && !earlyDiagnostic.hasProductElements) {
        logDebug(`🔄 РАННЯЯ ЗАЩИТА: Обнаружен редирект на главную/регион "${earlyDiagnostic.title}", кнопки: [${earlyDiagnostic.buttonTexts.slice(0, 5).join(', ')}]`);
        return { success: false, protectionDetected: true, error: 'Redirect to main/region page detected' };
      }
      
      // Если есть элементы продукта - это хорошо, продолжаем
      if (earlyDiagnostic.hasProductElements) {
        logDebug('✅ РАННЯЯ диагностика: Найдены элементы продукта, продолжаем извлечение');
      } else {
        logDebug(`⚠️ РАННЯЯ диагностика: Элементы продукта НЕ найдены, но ошибок тоже нет. Продолжаем с осторожностью.`);
      }
      
    } catch (diagError) {
      logDebug(`Ошибка ранней диагностики: ${diagError.message}`);
    }
    
    logDebug(`🔍 [DEBUG] Original URL: ${abbreviateUrl(link)}`);
    logDebug(`🔍 [DEBUG] Target URL: ${abbreviateUrl(targetUrl)}`);
    logDebug(`🔍 [DEBUG] Using proxy: ${proxy ? `${proxy.host}:${proxy.port}` : 'No proxy'}`);
    
    protectionDetected = hasProtection(currentUrl, pageTitle, pageContent);
    
    // Try extracting product data
    try {
      // Check for proof of product page - if we find clear product elements, override protection detection
      const isDefinitelyProductPage = await page.evaluate(() => {
        // These are very specific to product pages and won't be on protection pages
        const hasProductElements = 
          !!document.querySelector('h1[data-qa="get-product-title"]') ||
          !!document.querySelector('.product__title') ||
          !!document.querySelector('[data-qa="product-price"]') ||
          !!document.querySelector('[data-qa="product-add-to-cart-button"]');
          
        return hasProductElements;
      });
      
      if (isDefinitelyProductPage) {
        logDebug('Found definite product page elements - overriding any protection detection');
        
              // If we're sure it's a product page, move forward with extraction
      // КРИТИЧЕСКАЯ ПРОВЕРКА: Проверяем заголовок и URL ещё раз перед извлечением
      const currentTitleBeforeExtraction = await page.title();
      const currentUrlBeforeExtraction = page.url();
      logDebug(`Заголовок непосредственно перед извлечением: "${currentTitleBeforeExtraction}"`);
      logDebug(`URL непосредственно перед извлечением: ${currentUrlBeforeExtraction}`);
      
      if (currentTitleBeforeExtraction !== pageTitle) {
        logDebug(`⚠️ ВНИМАНИЕ: Заголовок изменился! Было: "${pageTitle}", стало: "${currentTitleBeforeExtraction}"`);
      }
      
      if (currentUrlBeforeExtraction !== currentUrl) {
        logDebug(`⚠️ ВНИМАНИЕ: URL изменился! Было: "${currentUrl}", стало: "${currentUrlBeforeExtraction}"`);
      }
      
      // 🚨 ДИАГНОСТИКА ПЕРЕД extractProductData
      logDebug(`🔍 [CRITICAL] === ДИАГНОСТИКА ПЕРЕД extractProductData ===`);
      try {
        const pageState = {
          isClosed: page.isClosed(),
          url: currentUrlBeforeExtraction,
          title: currentTitleBeforeExtraction
        };
        logDebug(`📊 [CRITICAL] Состояние страницы: ${JSON.stringify(pageState)}`);
        
        const browserConnected = browser.isConnected();
        logDebug(`🔗 [CRITICAL] Браузер подключен: ${browserConnected}`);
        
        if (!browserConnected) {
          throw new Error('Браузер отключен перед извлечением данных');
        }
        
        if (pageState.isClosed) {
          throw new Error('Страница закрыта перед извлечением данных');
        }
        
        logDebug(`✅ [CRITICAL] Все проверки пройдены, запускаем extractProductData...`);
      } catch (stateCheckError) {
        logDebug(`❌ [CRITICAL] Ошибка проверки состояния: ${stateCheckError.message}`);
        throw stateCheckError;
      }
      
      const extractStartTime = Date.now();
      const productData = await extractProductData(page, earlyPageTitle);
      const extractTime = Date.now() - extractStartTime;
      
      logDebug(`✅ [CRITICAL] extractProductData завершена за ${extractTime}ms`);
      logDebug(`📊 [CRITICAL] Результат: name="${productData.name}", price=${productData.price}`);
      
      // Проверяем качество данных
      if (!isDataQualityGood(productData)) {
        throw new Error('Извлеченные данные не соответствуют требованиям качества');
      }
        
        // Сохраняем HTML для дебага при успешном парсинге
        try {
          const htmlContent = await page.content();
          // Не сохраняем productData если это страница ошибки
          const dataToSave = (productData && productData.name && 
                               !productData.name.match(/главная|error|ошибка|не найдена|страница не найдена/i)) 
                               ? productData : null;
          await saveHtmlForDebug(htmlContent, link, dataToSave, { 
            proxy, 
            attempt: attemptNumber,
            originalUrl: link,
            targetUrl: targetUrl 
          });
        } catch (htmlError) {
          logDebug(`Не удалось сохранить HTML для дебага: ${htmlError.message}`);
          // Не прерываем выполнение если не удалось сохранить HTML
        }
        
        return { success: true, data: productData };
      }
      
      // If we're not sure it's definitely a product page, proceed with normal protection check
      if (protectionDetected) {
        logDebug('Protection detected and no clear product elements found');
        return { success: false, protectionDetected: true, error: 'Protection detected' };
      }
      
      // Normal extraction path
      // КРИТИЧЕСКАЯ ПРОВЕРКА: Проверяем заголовок и URL ещё раз перед извлечением
      const currentTitleBeforeExtraction = await page.title();
      const currentUrlBeforeExtraction = page.url();
      logDebug(`Заголовок непосредственно перед извлечением: "${currentTitleBeforeExtraction}"`);
      logDebug(`URL непосредственно перед извлечением: ${currentUrlBeforeExtraction}`);
      
      if (currentTitleBeforeExtraction !== pageTitle) {
        logDebug(`⚠️ ВНИМАНИЕ: Заголовок изменился! Было: "${pageTitle}", стало: "${currentTitleBeforeExtraction}"`);
      }
      
      if (currentUrlBeforeExtraction !== currentUrl) {
        logDebug(`⚠️ ВНИМАНИЕ: URL изменился! Было: "${currentUrl}", стало: "${currentUrlBeforeExtraction}"`);
      }
      
      // 🚨 ДИАГНОСТИКА ПЕРЕД extractProductData
      logDebug(`🔍 [CRITICAL] === ДИАГНОСТИКА ПЕРЕД extractProductData ===`);
      try {
        const pageState = {
          isClosed: page.isClosed(),
          url: currentUrlBeforeExtraction,
          title: currentTitleBeforeExtraction
        };
        logDebug(`📊 [CRITICAL] Состояние страницы: ${JSON.stringify(pageState)}`);
        
        const browserConnected = browser.isConnected();
        logDebug(`🔗 [CRITICAL] Браузер подключен: ${browserConnected}`);
        
        if (!browserConnected) {
          throw new Error('Браузер отключен перед извлечением данных');
        }
        
        if (pageState.isClosed) {
          throw new Error('Страница закрыта перед извлечением данных');
        }
        
        logDebug(`✅ [CRITICAL] Все проверки пройдены, запускаем extractProductData...`);
      } catch (stateCheckError) {
        logDebug(`❌ [CRITICAL] Ошибка проверки состояния: ${stateCheckError.message}`);
        throw stateCheckError;
      }
      
      const extractStartTime = Date.now();
      const productData = await extractProductData(page, earlyPageTitle);
      const extractTime = Date.now() - extractStartTime;
      
      logDebug(`✅ [CRITICAL] extractProductData завершена за ${extractTime}ms`);
      logDebug(`📊 [CRITICAL] Результат: name="${productData.name}", price=${productData.price}`);
      
      // Проверяем качество данных
      if (!isDataQualityGood(productData)) {
        throw new Error('Извлеченные данные не соответствуют требованиям качества');
      }
      
      // Сохраняем HTML для дебага при успешном парсинге
      try {
        const htmlContent = await page.content();
        // Не сохраняем productData если это страница ошибки
        const dataToSave = (productData && productData.name && 
                             !productData.name.match(/главная|error|ошибка|не найдена|страница не найдена/i)) 
                             ? productData : null;
        await saveHtmlForDebug(htmlContent, link, dataToSave, { 
          proxy, 
          attempt: attemptNumber,
          originalUrl: link,
          targetUrl: targetUrl 
        });
      } catch (htmlError) {
        logDebug(`Не удалось сохранить HTML для дебага: ${htmlError.message}`);
        // Не прерываем выполнение если не удалось сохранить HTML
      }
      
      return { success: true, data: productData };
    } catch (error) {
      logDebug(`Product extraction failed: ${error.message}`);
      
      // Проверяем, является ли это ошибкой защиты/страницы ошибки
      const isProtectionError = error.message && (
        error.message.includes('Страница ошибки/защиты обнаружена') ||
        error.message.includes('Обнаружена страница ошибки') ||
        error.message.includes('страница не найдена') ||
        error.message.includes('защита') ||
        error.message.includes('captcha')
      );
      
      if (isProtectionError) {
        logDebug('🛡️ Обнаружена защита/ошибка - помечаем как protectionDetected');
        return { success: false, protectionDetected: true, error: error.message };
      }
      
      return { success: false, error: error.message };
    }
    
  } catch (error) {
    // 🚨 КРИТИЧЕСКИЙ БЛОК: Детальная диагностика ошибок
    logDebug(`🚨 [ERROR] === КРИТИЧЕСКАЯ ОШИБКА В ATTEMPTCRAPE ===`);
    logDebug(`❌ [ERROR] Тип ошибки: ${error.constructor.name}`);
    logDebug(`📝 [ERROR] Сообщение: ${error.message}`);
    logDebug(`🔍 [ERROR] Stack trace: ${error.stack}`);
    
    // Дополнительная диагностика для контекста
    try {
      if (browser) {
        const browserConnected = browser.isConnected();
        logDebug(`🔗 [ERROR] Браузер подключен: ${browserConnected}`);
        
        if (browserConnected) {
          const pages = await browser.pages();
          logDebug(`📄 [ERROR] Количество открытых страниц: ${pages.length}`);
          
          if (page) {
            const pageUrl = await page.url().catch(e => `Ошибка получения URL: ${e.message}`);
            const pageTitle = await page.title().catch(e => `Ошибка получения заголовка: ${e.message}`);
            logDebug(`📄 [ERROR] URL страницы: ${pageUrl}`);
            logDebug(`📄 [ERROR] Заголовок страницы: ${pageTitle}`);
            
            // Проверяем состояние страницы
            const isClosed = page.isClosed();
            logDebug(`📄 [ERROR] Страница закрыта: ${isClosed}`);
          } else {
            logDebug(`📄 [ERROR] Объект page не определен`);
          }
        }
      } else {
        logDebug(`🌐 [ERROR] Объект browser не определен`);
      }
    } catch (diagError) {
      logDebug(`⚠️ [ERROR] Ошибка при диагностике: ${diagError.message}`);
    }
    
    // Специальная обработка для "Execution context was destroyed"
    if (error.message && error.message.includes('Execution context was destroyed')) {
      logDebug(`🔄 [ERROR] Обнаружена ошибка разрушения контекста выполнения`);
      logDebug(`💡 [ERROR] Это может указывать на:`);
      logDebug(`   - Неожиданная навигация или перезагрузка страницы`);
      logDebug(`   - Закрытие страницы/браузера во время выполнения`);
      logDebug(`   - Блокировка со стороны сайта или антибот защита`);
      logDebug(`   - Таймаут или проблемы с сетью`);
      
      // Дополнительная информация о состоянии на момент ошибки
      try {
        const elapsedTime = Date.now() - (startTime || functionStartTime);
        logDebug(`🕐 [ERROR] Время выполнения до ошибки: ${elapsedTime}ms`);
      } catch (timeError) {
        logDebug(`🕐 [ERROR] Не удалось вычислить время выполнения: ${timeError.message}`);
      }
      
      return { 
        success: false, 
        protectionDetected: true, 
        error: `Контекст выполнения разрушен (возможна антибот защита): ${error.message}` 
      };
    }
    
    logDebug(`Error during scraping: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    // Детальное логирование закрытия ресурсов
    logDebug(`🧹 [CLEANUP] Начинаем очистку ресурсов...`);
    
    try {
      if (browser) {
        const isConnected = browser.isConnected();
        logDebug(`🔗 [CLEANUP] Браузер подключен перед закрытием: ${isConnected}`);
        
        if (isConnected) {
          await browser.close();
          logDebug(`✅ [CLEANUP] Браузер успешно закрыт`);
        } else {
          logDebug(`⚠️ [CLEANUP] Браузер уже был отключен`);
        }
      } else {
        logDebug(`⚠️ [CLEANUP] Браузер не был инициализирован`);
      }
    } catch (closeError) {
      logDebug(`❌ [CLEANUP] Ошибка при закрытии браузера: ${closeError.message}`);
    }
  }
}

// Main scraping function with improved proxy support
export async function scrapeWithProxySupport(link, maxRetries = 10, progressHandler = null) {
  // 🔍 КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ - точка входа в скрапинг
  logDebug(`🎯 [MAIN] === НАЧАЛО СКРАПИНГА ===`);
  logDebug(`🔗 [MAIN] URL: ${link}`);
  logDebug(`🔄 [MAIN] Максимум попыток: ${maxRetries}`);
  logDebug(`📊 [MAIN] Progress handler: ${progressHandler ? 'Есть' : 'Нет'}`);
  
  try {
    // Периодически очищаем старые HTML файлы (с вероятностью 10%)
    if (Math.random() < 0.1) {
      logDebug(`🧹 [MAIN] Запускаем очистку старых HTML файлов...`);
      try {
        await cleanupOldHtmlFiles(7); // Удаляем файлы старше 7 дней
        logDebug(`✅ [MAIN] Очистка HTML файлов завершена`);
      } catch (error) {
        logDebug(`❌ [MAIN] Ошибка при очистке старых HTML файлов: ${error.message}`);
      }
    } else {
      logDebug(`⏭️ [MAIN] Пропускаем очистку HTML файлов (вероятность 10%)`);
    }
    
    // Notify about starting without proxy
    if (progressHandler) {
      logDebug(`📢 [MAIN] Уведомляем progress handler о начале попытки #1`);
      progressHandler.onAttemptStart(1);
    }
    
    logDebug(`🆓 [MAIN] Первая попытка БЕЗ прокси`);
    logDebug(`🔄 [MAIN] Вызываем attemptScrape(${link}, null, 1)...`);
    
    const result = await attemptScrape(link, null, 1);
    
    logDebug(`📝 [MAIN] Результат первой попытки: success=${result.success}, protectionDetected=${result.protectionDetected}`);
    if (result.error) {
      logDebug(`❌ [MAIN] Ошибка: ${result.error}`);
    }
    
    // Добавляем задержку между запросами чтобы избежать блокировки
    logDebug(`⏰ [MAIN] Задержка 2 секунды между запросами...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    logDebug(`✅ [MAIN] Задержка завершена`);
    
    if (result.success) {
      logDebug(`🎉 [MAIN] Первая попытка успешна, проверяем качество данных...`);
      // Дополнительная проверка качества данных
      if (isDataQualityGood(result.data)) {
        logDebug('✅ [MAIN] Данные без прокси соответствуют требованиям качества');
        return result;
      } else {
        logDebug('❌ [MAIN] Данные без прокси не соответствуют требованиям качества, переходим к прокси');
        // Принудительно запускаем режим с прокси
      }
    } else {
      logDebug(`💥 [MAIN] Первая попытка неуспешна`);
    }
    
  } catch (mainError) {
    logDebug(`🚨 [MAIN] КРИТИЧЕСКАЯ ОШИБКА в начале функции scrapeWithProxySupport: ${mainError.message}`);
    logDebug(`🔍 [MAIN] Stack trace: ${mainError.stack}`);
    throw mainError;
  }
  
  // Переходим к прокси если обнаружена защита ИЛИ данные некачественные
  const needsProxy = result.protectionDetected || 
                     (result.success && !isDataQualityGood(result.data)) ||
                     !result.success;
  
  if (needsProxy) {
    // Notify about protection detection
    if (progressHandler) {
      progressHandler.onProtectionDetected();
    }
    
    if (result.protectionDetected) {
      logDebug('Protection detected, switching to proxy mode');
    } else if (result.success) {
      logDebug('Low quality data detected, switching to proxy mode');
    } else {
      logDebug('Scraping failed, switching to proxy mode');
    }
    
    if (proxies.length === 0) {
      await fetchProxies();
    }
    
    if (proxies.length === 0) {
      logDebug('No proxies available from API');
      return { success: false, error: 'No proxies available' };
    }
    
    for (let attempt = 0; attempt < 10; attempt++) {
      const proxy = await getNextWorkingProxy();
      
      if (!proxy) {
        logDebug('No working proxies available');
        return { success: false, error: 'No working proxies available' };
      }
      
      // Notify about proxy usage
      if (progressHandler) {
        progressHandler.onUsingProxy(proxy);
        progressHandler.onAttemptStart(attempt + 2); // +2 because first attempt is without proxy
      }
      
      const proxyWorks = await testProxy(proxy);
      if (!proxyWorks) {
        logDebug(`Proxy ${proxy.host}:${proxy.port} failed test, trying next`);
        continue;
      }
      
      logDebug(`🔄 Attempting scrape with proxy ${proxy.host}:${proxy.port} (attempt ${attempt + 1}/${maxRetries})`);
      
      // Минимальная задержка между попытками
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Notify extraction is beginning
      if (progressHandler) {
        progressHandler.onExtracting();
      }
      
      const proxyResult = await attemptScrape(link, proxy, attempt + 2);
      
      if (proxyResult.success) {
        logDebug('Successfully scraped with proxy');
        return proxyResult;
      }
      
      if (proxyResult.protectionDetected) {
        logDebug('🛡️ Protection/error page still detected with this proxy, trying next proxy');
        markProxyAsFailed(proxy);
        continue; // Пробуем следующий прокси
      } else {
        logDebug(`❌ Failed with proxy but not due to protection: ${proxyResult.error}`);
        
        // Если ошибка связана с качеством данных, пробуем следующий прокси
        if (proxyResult.error && (
            proxyResult.error.includes('требованиям качества') ||
            proxyResult.error.includes('Could not find product name') ||
            proxyResult.error.includes('Недопустимое название продукта')
        )) {
          logDebug('🔄 Данные некачественные или не найдены, пробуем следующий прокси');
          continue; // Пробуем следующий прокси вместо возврата ошибки
        }
        
        // Если ошибка таймаута - пробуем следующий прокси
        if (proxyResult.error && (
            proxyResult.error.includes('timeout') ||
            proxyResult.error.includes('Navigation timeout') ||
            proxyResult.error.includes('Timeout')
        )) {
          logDebug('⏰ Таймаут с текущим прокси, пробуем следующий');
          markProxyAsFailed(proxy);
          continue; // Пробуем следующий прокси
        }
        
        // Для критических ошибок (сетевые проблемы и т.д.) возвращаем результат
        logDebug('💥 Критическая ошибка, не связанная с защитой или качеством данных');
        return proxyResult;
      }
    }
    
    return { success: false, error: 'All proxy attempts failed' };
           }
         
         // Поиск изображения в NUXT данных
         if (!result.image) {
           const rawDataStr = JSON.stringify(productData);
           // Ищем URL изображений
           const imagePatterns = [
             /https?:\/\/[^"]*\.(?:jpg|jpeg|png|webp)/gi,
             /"(\/[^"]*\.(?:jpg|jpeg|png|webp))"/gi,
           ];
           
           for (const pattern of imagePatterns) {
             const matches = rawDataStr.match(pattern);
             if (matches && matches[0]) {
               let imageUrl = matches[0].replace(/"/g, ''); // Убираем кавычки
               
               // Если URL относительный, делаем абсолютным
               if (imageUrl.startsWith('/')) {
                 imageUrl = 'https://cdn.vseinstrumenti.ru' + imageUrl;
               }
               
               result.image = imageUrl;
               break;
             }
           }
         }
         
         return result;
}

// Function to extract product data from window.__NUXT__ object (main method)
const extractFromNuxt = async (page) => {
  try {
    const nuxtData = await page.evaluate(() => {
      try {
        if (!window.__NUXT__ || !window.__NUXT__.data || !window.__NUXT__.data[0]) {
          return { success: false, error: 'Нет данных в window.__NUXT__' };
        }
        
        const productData = window.__NUXT__.data[0].product;
        
        if (!productData) {
          return { success: false, error: 'Нет product в данных' };
        }
        
        // Извлекаем данные напрямую из объекта
        const result = {
          success: true,
          name: productData.name || null,
          code: productData.code || null,
          price: null,
          brand: productData.brand?.name || null,
          availability: productData.availability?.atWarehouse || null,
          advantages: productData.advantages || null,
          characteristics: productData.characteristics || [],
          analogsCount: productData.analogsCount || null,
          image: null, // Будем искать отдельно
          rawData: JSON.stringify(productData).substring(0, 200) + '...'
        };
        
        // Пытаемся извлечь цену из разных мест
        if (productData.bestPrice) {
          if (typeof productData.bestPrice === 'object') {
            result.price = productData.bestPrice.currentPrice || productData.bestPrice.averagePrice;
          } else if (typeof productData.bestPrice === 'string' || typeof productData.bestPrice === 'number') {
            result.price = productData.bestPrice;
          }
        }
        
        // Дополнительный поиск цены в других местах
        if (!result.price && productData.price) {
          result.price = productData.price;
        }
        
        if (!result.price && productData.currentPrice) {
          result.price = productData.currentPrice;
        }
        
        // Поиск цены в описании товара
        if (!result.price && productData.advantages) {
          const priceMatch = productData.advantages.match(/(\d+)\s*₽/);
          if (priceMatch) {
            result.price = parseInt(priceMatch[1]);
          }
        }
        
        // Попытаемся найти цену в сыром JSON данных
        if (!result.price) {
          const rawDataStr = JSON.stringify(productData);
          // Ищем числа рядом с ценовыми индикаторами
          const pricePatterns = [
            /currentPrice[":]*\s*(\d+)/,
            /price[":]*\s*(\d+)/,
            /(\d{4,5})\s*₽/, // 4-5 цифр и рубль
            /"(\d{4,5})".*₽/, // цифры в кавычках рядом с рублем
            /(?:^|[,\[\s])(\d{4,5})(?=[,\]\s]|$)/, // Числа 4-5 цифр в массиве/объекте
          ];
          
          for (const pattern of pricePatterns) {
            const match = rawDataStr.match(pattern);
            if (match && match[1]) {
              const foundPrice = parseInt(match[1]);
              if (foundPrice > 100 && foundPrice < 1000000) { // Разумные пределы цены
                result.price = foundPrice;
                break;
              }
            }
          }
        }
        
        // Дополнительный поиск всех чисел в данных
        if (!result.price) {
          // Ищем все числа 4-5 цифр в данных
          const rawDataStr = JSON.stringify(productData); // Объявляем здесь тоже
          const allNumbers = rawDataStr.match(/\b(\d{4,5})\b/g);
          if (allNumbers) {
            // Фильтруем числа в разумном диапазоне цен
            const priceCandidate = allNumbers
              .map(n => parseInt(n))
              .filter(n => n >= 1000 && n <= 100000) // Цены от 1000 до 100000 рублей
              .find(n => n.toString().endsWith('90') || n.toString().endsWith('99') || n.toString().endsWith('00')); // Типичные цены
            
            if (priceCandidate) {
              result.price = priceCandidate;
            }
          }
        }
        
        return result;
        
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    return nuxtData;
  } catch (error) {
    return { success: false, error: `Ошибка извлечения NUXT данных: ${error.message}` };
  }
};

// Export the handler for the API route
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ message: 'Link processing API is operational' });
  }

  if (req.method === 'POST') {
    try {
      const { link } = req.body;

      if (!link) {
        return res.status(400).json({ error: 'No link provided' });
      }

      let url;
      try {
        url = new URL(link);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      const result = await scrapeWithProxySupport(link);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          error: result.error || 'Failed to process the link' 
        });
      }
    } catch (error) {
      console.error('Error processing link:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to process the link' 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
      }
      