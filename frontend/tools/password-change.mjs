/* Смена пароля из личного кабинета.

   Проверяем не только «получилось», но и то, что нельзя сменить пароль,
   зная только открытую сессию: текущий пароль спрашивается обязательно.
   В конце пароль возвращается на место, чтобы прогон ничего за собой
   не оставлял.

   Запуск:  node tools/password-change.mjs
*/
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const B = "http://localhost:8080";
const PW = readFileSync("../.env", "utf8").match(/^ADMIN_PASSWORD=(.*)$/m)[1].trim();
const TEMP = "vremennyi-parol-987";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const problems = [];

const login = async (password) => {
  await page.goto(`${B}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[autocomplete="username"]', "admin");
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1200);
  return new URL(page.url()).pathname !== "/login";
};

const change = async (current, next, repeat = next) => {
  await page.goto(`${B}/account`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.fill('input[autocomplete="current-password"]', current);
  const fresh = page.locator('input[autocomplete="new-password"]');
  await fresh.nth(0).fill(next);
  await fresh.nth(1).fill(repeat);
  await page.click('.auth__form button[type="submit"]');
  await page.waitForTimeout(1200);
  return {
    ok: await page.locator(".form-note").count(),
    error: (await page.locator(".form-error").textContent().catch(() => null)) ?? null,
  };
};

if (!(await login(PW))) problems.push("не удалось войти с исходным паролем");

// В кабинете видно, кто вошёл
await page.goto(`${B}/account`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const facts = await page.locator(".account__facts").textContent();
if (!facts.includes("admin")) problems.push("в кабинете не показан логин");

// Чужую сессию мало: нужен текущий пароль
const wrong = await change("совсем-не-тот-пароль", TEMP);
if (!wrong.error) problems.push("пароль сменился без знания текущего");

// Пароли должны совпадать
const mismatch = await change(PW, TEMP, "другое-совсем");
if (!mismatch.error) problems.push("приняты несовпадающие пароли");

// Настоящая смена
const done = await change(PW, TEMP);
if (!done.ok) problems.push(`смена не удалась: ${done.error}`);

// Сессия не должна обрываться
await page.goto(`${B}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
if (new URL(page.url()).pathname !== "/admin") problems.push("после смены выкинуло из сессии");

// Старый пароль больше не подходит, новый — подходит
await page.evaluate(async () => {
  const csrf = document.cookie.match(/csrf_access_token=([^;]+)/)?.[1];
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: csrf ? { "X-CSRF-TOKEN": csrf } : {},
    credentials: "same-origin",
  });
});
if (await login(PW)) problems.push("старый пароль всё ещё подходит");
if (!(await login(TEMP))) problems.push("новый пароль не подошёл");

// Возвращаем как было
const back = await change(TEMP, PW);
if (!back.ok) problems.push(`не удалось вернуть исходный пароль: ${back.error}`);

await browser.close();
console.log(
  problems.length
    ? `✗ Проблем: ${problems.length}\n  ${problems.join("\n  ")}`
    : "✓ Пароль меняется из кабинета, чужой сессии для этого мало.",
);
process.exit(problems.length ? 1 : 0);
