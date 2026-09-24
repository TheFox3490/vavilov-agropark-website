/* Переводы строк должны доживать от админки до страницы.

   Проверка появилась после того, как у текста проекта и услуги потерялось
   правило white-space: абзацы склеивались в один, и выглядело это так,
   будто Enter в админке не сохраняется.

   Запуск:  node tools/text-formatting.mjs
*/
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const B = "http://localhost:8080";
const PW = readFileSync("../.env", "utf8").match(/^ADMIN_PASSWORD=(.*)$/m)[1].trim();
const BODY = "Первый абзац.\n\nВторой абзац.\nСтрока после одиночного переноса.";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const problems = [];

await page.goto(`${B}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[autocomplete="username"]', "admin");
await page.fill('input[type="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForTimeout(1200);

// Создаём временные записи прямо через API — форму админки проверяют другие наборы.
const call = (path, method, body) =>
  page.evaluate(
    async ([p, m, b]) => {
      const csrf = document.cookie.match(/csrf_access_token=([^;]+)/)[1];
      const r = await fetch(p, {
        method: m,
        headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": csrf },
        credentials: "same-origin",
        body: b ? JSON.stringify(b) : undefined,
      });
      return r.status === 204 ? null : r.json();
    },
    [path, method, body],
  );

const made = [];
for (const [kind, path] of [
  ["проект", "/api/admin/projects"],
  ["услуга", "/api/admin/services"],
]) {
  const res = await call(path, "POST", { title: `Проверка переносов (${kind})`, body: BODY });
  made.push([path, res.item.id]);

  const page2 = `${kind === "проект" ? "/projects" : "/services"}/${res.item.slug}`;
  await page.goto(B + page2, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const seen = await page.evaluate(() => {
    const el = document.querySelector(".detail__body");
    if (!el) return null;
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = new Set([...range.getClientRects()].filter((r) => r.width).map((r) => Math.round(r.top)));
    return { ws: getComputedStyle(el).whiteSpace, lines: lines.size };
  });
  if (!seen) problems.push(`${kind}: текст на странице не найден`);
  else {
    if (seen.ws !== "pre-line") problems.push(`${kind}: white-space ${seen.ws}, переносы схлопнутся`);
    // Три абзаца/строки должны дать минимум три строки на экране.
    if (seen.lines < 3) problems.push(`${kind}: строк на странице ${seen.lines}, ожидалось не меньше 3`);
  }
}

// Новость: текст показывается в модалке
const news = await call("/api/admin/news", "POST", { title: "Проверка переносов (новость)", body: BODY });
made.push(["/api/admin/news", news.item.id]);
await page.goto(`${B}/news`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.locator('.news-card:has-text("Проверка переносов")').first().click();
await page.waitForTimeout(800);
const modal = await page.evaluate(() => {
  const el = document.querySelector(".modal__text");
  if (!el) return null;
  const range = document.createRange();
  range.selectNodeContents(el);
  const lines = new Set([...range.getClientRects()].filter((r) => r.width).map((r) => Math.round(r.top)));
  return { ws: getComputedStyle(el).whiteSpace, lines: lines.size };
});
if (!modal) problems.push("новость: текст в модалке не найден");
else {
  if (modal.ws !== "pre-line") problems.push(`новость: white-space ${modal.ws}`);
  if (modal.lines < 3) problems.push(`новость: строк ${modal.lines}, ожидалось не меньше 3`);
}

// Правовой документ: абзацы и заголовки разбираются, переносы внутри абзаца живут
await page.goto(`${B}/privacy`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
const legal = await page.evaluate(() => {
  const p = document.querySelector(".legal__text") ?? document.querySelector(".legal__intro");
  return { ws: p ? getComputedStyle(p).whiteSpace : null, headings: document.querySelectorAll(".legal__heading").length };
});
if (legal.ws !== "pre-line") problems.push(`документ: white-space ${legal.ws}`);
if (legal.headings === 0) problems.push("документ: разделы не разобрались");

for (const [path, id] of made) await call(`${path}/${id}`, "DELETE");

await browser.close();
console.log(
  problems.length
    ? `✗ Проблем: ${problems.length}\n  ${problems.join("\n  ")}`
    : "✓ Переводы строк доживают от админки до страницы.",
);
process.exit(problems.length ? 1 : 0);
