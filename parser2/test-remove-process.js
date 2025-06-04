import puppeteer from 'puppeteer';

console.log('🔥 ТЕСТ: Удаление объекта process (КЛЮЧЕВОЕ РЕШЕНИЕ!)\n');

const testRemoveProcess = async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  // КРИТИЧЕСКАЯ АНТИ-ДЕТЕКЦИЯ: УДАЛЯЕМ PROCESS!
  await page.evaluateOnNewDocument(() => {
    // 🔥 УДАЛЯЕМ ОБЪЕКТ PROCESS (основная детекция Puppeteer!)
    if (typeof process !== 'undefined') {
      delete window.process;
      delete global.process;
      delete globalThis.process;
    }
    
    // Стандартная анти-детекция
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
    delete navigator.__proto__.webdriver;
    
    // Удаляем другие следы автоматизации
    delete window.navigator.webdriver;
    delete window.chrome.runtime.onConnect;
    delete window.chrome.runtime.onMessage;
  });
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36');
  
  console.log('🧪 Тест без объекта process...');
  
  try {
    const response = await page.goto('https://www.vseinstrumenti.ru/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    console.log(`✅ БЕЗ PROCESS: ${response.status()}`);
    
    if (response.status() === 200) {
      console.log('🎉 УСПЕХ! Объект process был ключевой проблемой!');
    }
    
  } catch (error) {
    console.log(`❌ Ошибка: ${error.message}`);
  }
  
  await browser.close();
};

await testRemoveProcess();

console.log('\n🏁 Тест удаления process завершен!'); 