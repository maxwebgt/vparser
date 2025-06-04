import puppeteer from 'puppeteer';
import fetch from 'node-fetch';

console.log('🔍 Тестируем поведение vseinstrumenti.ru...\n');

// Тест 1: Простой fetch запрос
console.log('=== ТЕСТ 1: Простой fetch ===');
try {
  const response = await fetch('https://www.vseinstrumenti.ru/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
    }
  });
  console.log(`Статус: ${response.status}`);
  console.log(`Заголовки: ${JSON.stringify([...response.headers.entries()], null, 2)}`);
} catch (error) {
  console.log(`Ошибка: ${error.message}`);
}

console.log('\n=== ТЕСТ 2: Puppeteer - быстрый запрос ===');
const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

// Без всяких настроек анти-детекции
try {
  const response1 = await page.goto('https://www.vseinstrumenti.ru/', { waitUntil: 'domcontentloaded' });
  console.log(`Быстрый запрос: ${response1.status()}`);
} catch (error) {
  console.log(`Ошибка быстрого запроса: ${error.message}`);
}

console.log('\n=== ТЕСТ 3: Puppeteer - повторный запрос через 3 сек ===');
await new Promise(resolve => setTimeout(resolve, 3000));
try {
  const response2 = await page.goto('https://www.vseinstrumenti.ru/', { waitUntil: 'domcontentloaded' });
  console.log(`Повторный запрос: ${response2.status()}`);
} catch (error) {
  console.log(`Ошибка повторного запроса: ${error.message}`);
}

await browser.close();
console.log('\n✅ Тестирование завершено!'); 