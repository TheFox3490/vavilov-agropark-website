/* Проверяет, что первый экран помещается в окно браузера целиком.

   Макет нарисован высотой 970px — под окно на мониторе 1080p без
   масштабирования. Реальные окна почти всегда ниже: панель закладок,
   масштабирование Windows, ноутбучный экран. Размеры первого экрана
   ужимаются ступенями по высоте окна (см. tokens.css), и этот тест
   стережёт, чтобы ступени продолжали справляться.

   Запуск:  node tools/hero-fit.mjs
*/

import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:8080";

const VIEWPORTS = [
  [1920, 1080, "монитор 1080p, окно во весь экран"],
  [1920, 960, "монитор 1080p, обычное окно браузера"],
  [1600, 900, "ноутбук 900p"],
  [1536, 864, "1080p при масштабе Windows 125%"],
  [1536, 760, "то же с панелью закладок"],
  [1536, 720, "то же с расширенной панелью"],
  [1440, 780, "MacBook Air"],
  [1366, 660, "бюджетный ноутбук"],
  [1280, 700, "небольшое окно"],
  [1024, 600, "нетбук"],
  [1280, 1024, "квадратный монитор"],
];

const browser = await chromium.launch();
let failures = 0;

console.log("  окно        первый экран  запас  кегль   что это");
for (const [width, height, label] of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => ({
    hero: Math.round(document.querySelector(".hero").getBoundingClientRect().height),
    viewport: window.innerHeight,
    fontSize: getComputedStyle(document.querySelector(".hero__title")).fontSize,
  }));

  // Один пиксель допуска на округление subpixel-раскладки.
  const fits = result.hero <= result.viewport + 1;
  if (!fits) failures++;

  console.log(
    `  ${fits ? "✓" : "✗"} ${String(`${width}x${height}`).padEnd(11)}` +
      `${String(result.hero).padStart(10)}` +
      `${String(result.viewport - result.hero).padStart(7)}` +
      `${result.fontSize.padStart(8)}   ${label}`,
  );

  await context.close();
}

await browser.close();
console.log(
  failures === 0
    ? "\nПервый экран помещается во всех окнах."
    : `\nНе помещается в ${failures} окнах.`,
);
