import puppeteer from 'puppeteer';

console.log('🔍 ДЕТАЛЬНАЯ ПРОВЕРКА: Браузер остается открытым\n');

const keepBrowserOpen = async () => {
  console.log('🌐 Открываем браузер (НЕ ЗАКРОЕТСЯ АВТОМАТИЧЕСКИ!)');
  
  const browser = await puppeteer.launch({ 
    headless: false,  // РЕАЛЬНОЕ ОКНО
    devtools: true,   // С DevTools
    args: [
      '--start-maximized',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars'
    ]
  });
  
  const page = await browser.newPage();
  
  console.log('\n📋 ПОДРОБНЫЕ ИНСТРУКЦИИ:');
  console.log('1. Браузер откроется и ОСТАНЕТСЯ ОТКРЫТЫМ');
  console.log('2. Попробуй перейти на https://www.vseinstrumenti.ru/');
  console.log('3. Посмотри в DevTools -> Network что происходит');
  console.log('4. Проверь есть ли редиректы, какие заголовки');
  console.log('5. Попробуй обновить страницу (F5)');
  console.log('6. Сравни с обычным Chrome');
  console.log('7. ВАЖНО: Закрой браузер ВРУЧНУЮ когда закончишь');
  console.log('8. Или нажми Ctrl+C в этом терминале\n');
  
  console.log('⏰ Браузер готов к исследованию! Жду твоих команд...');
  console.log('💡 Браузер НЕ закроется автоматически - исследуй спокойно!\n');
  
  // Держим скрипт живым до принудительного завершения
  process.on('SIGINT', async () => {
    console.log('\n🔴 Получен сигнал завершения, закрываю браузер...');
    await browser.close();
    process.exit(0);
  });
  
  // Бесконечный цикл - браузер не закроется
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('⏰ Браузер все еще открыт... (нажми Ctrl+C для завершения)');
  }
};

await keepBrowserOpen(); 