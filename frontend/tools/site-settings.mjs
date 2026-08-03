/* Проверка вкладки «Сайт»: контакты и правовые документы правятся из админки
   и сразу видны на сайте.

   Запуск:  node tools/site-settings.mjs
*/
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const B = "http://localhost:8080";
const PW = readFileSync("../.env", "utf8").match(/^ADMIN_PASSWORD=(.*)$/m)[1].trim();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const problems = [];

await page.goto(`${B}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[autocomplete="username"]', "admin");
await page.fill('input[type="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForTimeout(1200);

// Запоминаем исходные значения, чтобы вернуть их в конце.
const before = await fetch(`${B}/api/settings`).then((r) => r.json()).then((d) => d.settings);

await page.goto(`${B}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.click('button:has-text("Сайт")');
await page.waitForTimeout(700);

const saveButton = page.locator('.admin__site button[type="submit"]');
if (await saveButton.isEnabled()) problems.push("кнопка сохранения активна без правок");

// --- Контакты ---
const phone = page.locator('.admin__site input.input').first();
await phone.fill("+7 (900) 000-11-22");
await page.locator('.admin__site input.input').nth(3).fill(""); // ВКонтакте
await page.waitForTimeout(200);
if (!(await saveButton.isEnabled())) problems.push("кнопка сохранения не включилась после правки");
await saveButton.click();
await page.waitForTimeout(1500);

await page.goto(`${B}/contacts`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
const contacts = await page.evaluate(() => ({
  text: document.querySelector(".contacts__card:nth-of-type(2)")?.textContent ?? document.body.innerText,
  socials: [...document.querySelectorAll(".footer .socials a")].map((a) => a.getAttribute("aria-label")),
  tel: document.querySelector('a[href^="tel:"]')?.getAttribute("href"),
}));
if (!contacts.text.includes("+7 (900) 000-11-22")) problems.push("новый телефон не появился на «Контактах»");
if (contacts.tel !== "tel:+79000001122") problems.push(`ссылка звонка: ${contacts.tel}`);
if (contacts.socials.includes("ВКонтакте")) problems.push("пустая ссылка ВК всё равно показывается иконкой");

// --- Документ ---
await page.goto(`${B}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.click('button:has-text("Сайт")');
await page.waitForTimeout(700);
await page.locator(".admin__doc").first().locator("input.input").fill("Политика — проверка");
await page.locator(".admin__doc").first().locator("textarea").fill(
  "Вводный абзац документа.\n\n## Первый раздел\n\nТекст первого раздела.\n\n## Второй раздел\n\nТекст второго раздела.",
);
await page.locator('.admin__site input[type="checkbox"]').uncheck();
await page.locator('.admin__site button[type="submit"]').click();
await page.waitForTimeout(1500);

await page.goto(`${B}/privacy`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
const doc = await page.evaluate(() => ({
  title: document.querySelector(".card-list__title")?.textContent,
  headings: [...document.querySelectorAll(".legal__heading")].map((h) => h.textContent),
  paragraphs: [...document.querySelectorAll(".legal__intro, .legal__text")].length,
  note: !!document.querySelector(".legal__note"),
}));
if (doc.title !== "Политика — проверка") problems.push(`заголовок документа: ${doc.title}`);
if (doc.headings.join("|") !== "Первый раздел|Второй раздел")
  problems.push(`разделы разобраны неверно: ${doc.headings.join("|")}`);
if (doc.paragraphs !== 3) problems.push(`абзацев ${doc.paragraphs}, ожидалось 3`);
if (doc.note) problems.push("пометка про черновик осталась после снятия галочки");

// --- Возвращаем как было ---
await page.evaluate(async ([base, settings]) => {
  const csrf = document.cookie.match(/csrf_access_token=([^;]+)/)[1];
  await fetch(`${base}/api/admin/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": csrf },
    credentials: "same-origin",
    body: JSON.stringify({ settings }),
  });
}, [B, before]);
await page.waitForTimeout(500);
const after = await fetch(`${B}/api/settings`).then((r) => r.json()).then((d) => d.settings);
const restored = Object.keys(before).every((k) => before[k] === after[k]);
if (!restored) problems.push("не удалось вернуть исходные настройки");

await browser.close();
console.log(problems.length ? `✗ Проблем: ${problems.length}\n  ${problems.join("\n  ")}` : "✓ Настройки сайта правятся из админки и применяются на сайте.");
process.exit(problems.length ? 1 : 0);
