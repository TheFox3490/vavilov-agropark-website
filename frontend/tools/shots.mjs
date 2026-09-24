/* Снимает страницы сайта на нескольких размерах экрана и проверяет,
   не вылезает ли содержимое за границы вьюпорта.

   Запуск:  node tools/shots.mjs [базовый-URL]
*/

import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:8080";
const OUT = "../figma-export/shots";

const VIEWPORTS = [
  { name: "iphone-xr", width: 414, height: 896, mobile: true },
  { name: "iphone-se", width: 375, height: 667, mobile: true },
  { name: "galaxy-fold", width: 344, height: 882, mobile: true },
  { name: "ipad", width: 820, height: 1180, mobile: true },
  { name: "desktop", width: 1440, height: 900, mobile: false },
];

const PAGES = ["/", "/news", "/services", "/projects", "/team", "/login"];

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

let problems = 0;

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    userAgent: vp.mobile ? devices["iPhone 12"].userAgent : undefined,
  });
  const page = await context.newPage();

  for (const path of PAGES) {
    // networkidle не годится: на Контактах бесконечно тянется виджет Яндекс.Карт.
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(700);

    // Горизонтальная прокрутка страницы — верный признак сломанной вёрстки.
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const offenders = [];

      // Элемент не считается вылезшим, если любой из предков его обрезает
      // или прокручивает: так ведут себя фоновые пятна и карусели.
      const clipped = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === "hidden" || ox === "auto" || ox === "scroll" || ox === "clip") return true;
        }
        return false;
      };

      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (getComputedStyle(el).position === "fixed") continue;
        if (clipped(el)) continue;
        if (r.right > doc.clientWidth + 1 || r.left < -1) {
          offenders.push(
            `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} ` +
              `[${Math.round(r.left)}..${Math.round(r.right)}]`,
          );
        }
      }
      return {
        scrollW: doc.scrollWidth,
        clientW: doc.clientWidth,
        offenders: [...new Set(offenders)].slice(0, 6),
      };
    });

    const slug = path === "/" ? "home" : path.replace(/\//g, "");
    await page.screenshot({
      path: `${OUT}/${vp.name}--${slug}.png`,
      fullPage: path === "/",
    });

    const bad = overflow.scrollW > overflow.clientW + 1;
    if (bad || overflow.offenders.length) {
      problems++;
      console.log(
        `  ✗ ${vp.name} ${path}: scrollWidth ${overflow.scrollW} > ${overflow.clientW}`,
      );
      for (const o of overflow.offenders) console.log(`      ${o}`);
    } else {
      console.log(`  ✓ ${vp.name} ${path}`);
    }
  }

  await context.close();
}

await browser.close();
console.log(problems === 0 ? "\nПереполнений не найдено." : `\nПроблемных экранов: ${problems}`);
