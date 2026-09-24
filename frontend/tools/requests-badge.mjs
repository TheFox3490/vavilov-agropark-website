/* Значок необработанных заявок: появляется в шапке и на вкладке,
   гаснет, когда заявку отметили обработанной.

   Смысл значка в том, чтобы обращение заметили, поэтому проверяем его
   на обычной странице сайта, а не только внутри админки.

   Запуск:  node tools/requests-badge.mjs
*/
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const B = "http://localhost:8080";
const PW = readFileSync("../.env", "utf8").match(/^ADMIN_PASSWORD=(.*)$/m)[1].trim();
const browser = await chromium.launch();
const problems = [];

// 1. Гость оставляет заявку через форму
const guest = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await guest.goto(`${B}/team`, { waitUntil: "domcontentloaded" });
await guest.waitForTimeout(900);
if (await guest.locator(".nav__badge").count()) problems.push("значок виден гостю");
await guest.fill('input[placeholder="Ваше имя"]', "Проверка значка");
await guest.fill('input[placeholder="Ваш телефон"]', "+7 900 000-00-00");
await guest.fill('textarea', "Заявка для проверки счётчика.");
await guest.check(".contacts__consent input");
await guest.click(".contacts__submit");
await guest.waitForTimeout(1500);
await guest.close();

// 2. Администратор видит значок на любой странице
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.goto(`${B}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[autocomplete="username"]', "admin");
await page.fill('input[type="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForTimeout(1500);

await page.goto(`${B}/news`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const onPage = await page.locator(".nav__badge").first().textContent().catch(() => null);
if (onPage !== "1") problems.push(`значок в шапке на «Новостях»: ${onPage}`);

// 3. На вкладке «Заявки» тоже
await page.goto(`${B}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const onTab = await page.locator('button:has-text("Заявки") .nav__badge').textContent().catch(() => null);
if (onTab !== "1") problems.push(`значок на вкладке: ${onTab}`);

// 4. Отметили обработанной — значок гаснет
await page.click('button:has-text("Заявки")');
await page.waitForTimeout(900);
await page.locator('.admin__table button:has-text("Новая")').first().click();
await page.waitForTimeout(1500);
if (await page.locator(".nav__badge").count()) problems.push("значок остался после отметки «обработана»");

// 5. Прибираем за собой
await page.locator(".admin__table .admin__danger").first().click();
await page.waitForTimeout(200);
page.on("dialog", (d) => d.accept());
await page.locator(".admin__table .admin__danger").first().click().catch(() => {});
await page.waitForTimeout(1200);

await browser.close();
console.log(problems.length ? `✗ Проблем: ${problems.length}\n  ${problems.join("\n  ")}` : "✓ Счётчик заявок работает.");
process.exit(problems.length ? 1 : 0);
