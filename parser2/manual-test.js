import puppeteer from 'puppeteer';

console.log('🔍 РУЧНАЯ ПРОВЕРКА: Открываем реальный браузер для ручного тестирования\n');

const manualTest = async () => {
  console.log('🌐 Открываем браузер... НЕ ЗАКРЫВАЙ ЕГО!');
  
  const browser = await puppeteer.launch({ 
    headless: false,  // РЕАЛЬНОЕ ОКНО
    devtools: true,   // С DevTools
    args: [
      '--start-maximized',
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });
  
  const page = await browser.newPage();
  
  console.log('\n📋 ИНСТРУКЦИИ:');
  console.log('1. Браузер откроется сейчас');
  console.log('2. ВРУЧНУЮ перейди на https://www.vseinstrumenti.ru/');
  console.log('3. Посмотри - получаешь ли ты 403 или сайт загружается нормально');
  console.log('4. Проверь DevTools -> Network');
  console.log('5. После проверки закрой браузер или нажми Ctrl+C');
  
  console.log('\n⏰ Жду 60 секунд для ручной проверки...\n');
  
  // Ждем 60 секунд для ручного тестирования
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  console.log('⏰ Время вышло, закрываю браузер...');
  await browser.close();
};

await manualTest();

console.log('\n🏁 Ручная проверка завершена!'); 