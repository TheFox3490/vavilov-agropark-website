/* Проверяет, не залипает ли :hover после касания на тач-устройствах.

   Воспроизводит ситуацию из DevTools: включена эмуляция мобильного устройства,
   и нажатия идут как касания пальцем, а не как клики мышью.

   Раньше проверка шла на фильтрах категорий в ленте новостей. Категории
   с сайта убраны, а те же переключатели-«чипы» остались вкладками админки —
   поэтому проверка входит под администратором и нажимает вкладки.

   Запуск:  node tools/touch-check.mjs
*/

import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:8080";
const PW = readFileSync("../.env", "utf8").match(/^ADMIN_PASSWORD=(.*)$/m)[1].trim();
const ACTIVE_BG = "rgb(255, 255, 255)"; // белый — цвет выбранной вкладки

async function openAdmin(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[autocomplete="username"]', "admin");
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
}

const browser = await chromium.launch();
let failures = 0;

function check(label, ok, extra = "") {
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);
}

// --- Тач-режим: касание по вкладке -----------------------------------------
{
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await openAdmin(page);

  console.log("\niPhone XR, касание пальцем");

  const chip = page.locator(".chip", { hasText: "Проекты" });
  await chip.tap();
  await page.waitForTimeout(500);

  const state = await chip.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color,
    isActive: el.classList.contains("chip--active"),
  }));

  check("вкладка помечена активной", state.isActive);
  check("фон стал белым сразу после касания", state.bg === ACTIVE_BG, `сейчас ${state.bg}`);
  check("текст стал тёмным", state.color === "rgb(22, 20, 29)", `сейчас ${state.color}`);

  // Прежняя вкладка не должна остаться подсвеченной.
  const other = page.locator(".chip", { hasText: "Новости" });
  const otherBg = await other.evaluate((el) => getComputedStyle(el).backgroundColor);
  check("остальные вкладки без подсветки", otherBg === "rgba(0, 0, 0, 0)", `сейчас ${otherBg}`);

  await context.close();
}

// --- Мышь: наведение на уже выбранную вкладку ------------------------------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await openAdmin(page);

  console.log("\nДесктоп, мышь");

  const chip = page.locator(".chip", { hasText: "Услуги" });
  await chip.click();
  await page.waitForTimeout(400);
  const afterClick = await chip.evaluate((el) => getComputedStyle(el).backgroundColor);
  check("выбранная вкладка белая под курсором", afterClick !== "rgba(255, 255, 255, 0.12)", `сейчас ${afterClick}`);

  // Уводим курсор и проверяем, что цвет остался активным.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  const afterLeave = await chip.evaluate((el) => getComputedStyle(el).backgroundColor);
  check("цвет держится после ухода курсора", afterLeave === ACTIVE_BG, `сейчас ${afterLeave}`);

  // Наведение на невыбранную вкладку должно подсвечивать.
  const other = page.locator(".chip", { hasText: "Сайт" });
  await other.hover();
  await page.waitForTimeout(300);
  const hovered = await other.evaluate((el) => getComputedStyle(el).backgroundColor);
  check("наведение на мыши по-прежнему работает", hovered === "rgba(255, 255, 255, 0.12)", `сейчас ${hovered}`);

  await context.close();
}

await browser.close();
console.log(failures === 0 ? "\nВсе проверки пройдены." : `\nПровалено проверок: ${failures}`);
