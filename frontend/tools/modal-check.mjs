/* Проверяет модалку новости: перекрывает ли её шапка, доступна ли кнопка
   закрытия на длинных материалах и долистывается ли текст до конца.

   Запуск:  node tools/modal-check.mjs
*/

import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:8080";

const CASES = [
  // 1920×1080 при масштабе Windows 125% даёт CSS-вьюпорт 1536×864.
  { name: "ноутбук 1920×1080 @125%", width: 1536, height: 864, mobile: false },
  { name: "десктоп 1440×900", width: 1440, height: 900, mobile: false },
  { name: "iPhone XR 414×896", width: 414, height: 896, mobile: true },
  { name: "Galaxy Fold 344×882", width: 344, height: 882, mobile: true },
];

const browser = await chromium.launch();
let failures = 0;

for (const vp of CASES) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/news`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  // Открываем самый длинный материал — настоящую статью про «Туман-3».
  const cards = page.locator(".news-card");
  const count = await cards.count();
  let target = cards.first();
  for (let i = 0; i < count; i++) {
    const text = await cards.nth(i).innerText();
    if (text.includes("Туман-3")) {
      target = cards.nth(i);
      break;
    }
  }
  await target.scrollIntoViewIfNeeded();
  await (vp.mobile ? target.tap() : target.click());
  await page.waitForTimeout(800);

  const result = await page.evaluate(async () => {
    const body = document.querySelector(".modal__body");
    const close = document.querySelector(".modal__close");
    const report = {};

    // 1. Перекрывает ли что-нибудь кнопку закрытия (например, липкая шапка).
    const topCheck = () => {
      const r = close.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { onTop: close.contains(hit) || hit === close, covering: hit?.className ?? hit?.tagName };
    };
    report.beforeScroll = topCheck();
    report.closeInViewport =
      close.getBoundingClientRect().top >= 0 &&
      close.getBoundingClientRect().bottom <= window.innerHeight;

    // 2. Листаем материал до самого низа и проверяем кнопку снова.
    body.scrollTop = body.scrollHeight;
    await new Promise((r) => setTimeout(r, 250));
    report.afterScroll = topCheck();
    const rc = close.getBoundingClientRect();
    report.closeInViewportAfter = rc.top >= 0 && rc.bottom <= window.innerHeight;

    // 3. Достижим ли конец текста.
    report.scrolledToEnd = Math.abs(body.scrollTop + body.clientHeight - body.scrollHeight) < 2;

    // 4. Помещается ли само окно в экран.
    const br = body.getBoundingClientRect();
    report.fitsViewport = br.top >= -1 && br.bottom <= window.innerHeight + 1;
    report.bodyBottom = Math.round(br.bottom);
    report.viewportH = window.innerHeight;
    return report;
  });

  const checks = [
    ["кнопка сверху всех слоёв", result.beforeScroll.onTop, result.beforeScroll.covering],
    ["кнопка видна до прокрутки", result.closeInViewport, ""],
    ["кнопка видна после прокрутки", result.closeInViewportAfter, ""],
    ["кнопка кликабельна внизу", result.afterScroll.onTop, result.afterScroll.covering],
    ["текст долистывается до конца", result.scrolledToEnd, ""],
    ["окно влезает в экран", result.fitsViewport, `низ ${result.bodyBottom} / ${result.viewportH}`],
  ];

  console.log(`\n${vp.name}`);
  for (const [label, ok, extra] of checks) {
    if (!ok) failures++;
    console.log(`  ${ok ? "✓" : "✗"} ${label}${!ok && extra ? ` — мешает: ${extra}` : ""}`);
  }

  await context.close();
}

await browser.close();
console.log(failures === 0 ? "\nВсе проверки пройдены." : `\nПровалено проверок: ${failures}`);
