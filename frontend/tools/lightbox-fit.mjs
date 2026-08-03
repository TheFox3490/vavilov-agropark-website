/* Проверка просмотра кадра во весь экран: кадр обязан помещаться в окно
   целиком при любом его размере и любой пропорции картинки.

   Отдельная проверка появилась после того, как увеличенная картинка
   не влезала в окно 1920×1080 при масштабе Windows 125% и её приходилось
   разглядывать прокруткой.

   Запуск:  node tools/lightbox-fit.mjs [адрес-проекта]
*/
import { chromium, devices } from "playwright";

const B = "http://localhost:8080";
const SLUG = process.argv[2] ?? "vr-tehnum";

const WINDOWS = [
  { n: "1536x760", w: 1536, h: 760, m: false, note: "1080p при масштабе Windows 125%" },
  { n: "1536x720", w: 1536, h: 720, m: false, note: "то же с панелью закладок" },
  { n: "1920x960", w: 1920, h: 960, m: false, note: "монитор 1080p, обычное окно" },
  { n: "1366x660", w: 1366, h: 660, m: false, note: "бюджетный ноутбук" },
  { n: "1024x600", w: 1024, h: 600, m: false, note: "нетбук" },
  { n: "414x896", w: 414, h: 896, m: true, note: "iPhone XR" },
  { n: "344x882", w: 344, h: 882, m: true, note: "Galaxy Fold" },
];

const browser = await chromium.launch();
let bad = 0;

for (const win of WINDOWS) {
  const ctx = await browser.newContext({
    viewport: { width: win.w, height: win.h },
    isMobile: win.m,
    hasTouch: win.m,
    userAgent: win.m ? devices["iPhone 12"].userAgent : undefined,
  });
  const page = await ctx.newPage();
  await page.goto(`${B}/startups/${SLUG}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const count = await page.locator(".gallery__thumb").count();
  if (count < 2) {
    console.log(
      `У проекта «${SLUG}» нет дополнительных кадров — увеличивать нечего.\n` +
        "Добавьте кадры в админке или укажите другой адрес проекта аргументом.",
    );
    await ctx.close();
    await browser.close();
    // Нечего проверять — это не поломка: у проекта просто нет галереи.
    process.exit(0);
  }
  const problems = [];

  for (let i = 0; i < count; i++) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator(".gallery__thumb").nth(i).click();
    await page.waitForTimeout(250);
    await page.click(".gallery__stage");
    await page.waitForTimeout(350);

    const r = await page.evaluate(() => {
      const img = document.querySelector(".lightbox__img");
      if (!img) return { missing: true };
      const b = img.getBoundingClientRect();
      const box = document.querySelector(".lightbox").getBoundingClientRect();
      const caption = document.querySelector(".lightbox__caption").getBoundingClientRect();
      return {
        fits: b.top >= -1 && b.left >= -1 && b.bottom <= innerHeight + 1 && b.right <= innerWidth + 1,
        captionVisible: caption.bottom <= innerHeight + 1,
        // Прокрутка внутри самого просмотрщика: страница под ним заперта,
        // её высоту мерить бессмысленно.
        scrolls: (() => {
          const lb = document.querySelector(".lightbox");
          return lb.scrollHeight > lb.clientHeight + 1 || lb.scrollWidth > lb.clientWidth + 1;
        })(),
        w: Math.round(b.width),
        h: Math.round(b.height),
        natural: `${img.naturalWidth}x${img.naturalHeight}`,
        overflowBottom: Math.round(b.bottom - innerHeight),
      };
    });

    if (r.missing) problems.push(`кадр ${i + 1}: просмотрщик не открылся`);
    else {
      if (!r.fits) problems.push(`кадр ${i + 1} (${r.natural}) вылезает на ${r.overflowBottom}px`);
      if (!r.captionVisible) problems.push(`кадр ${i + 1}: подпись за экраном`);
      if (r.scrolls) problems.push(`кадр ${i + 1}: появилась прокрутка`);
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  // Стрелки внутри просмотрщика
  await page.click(".gallery__stage");
  await page.waitForTimeout(300);
  const first = await page.getAttribute(".lightbox__img", "src");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  const second = await page.getAttribute(".lightbox__img", "src");
  if (first === second) problems.push("стрелка → не листает");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  if (await page.locator(".lightbox").count()) problems.push("не закрывается по Escape");

  if (problems.length) bad++;
  console.log(
    `${problems.length ? "✗" : "✓"} ${win.n.padEnd(9)} ${win.note.padEnd(36)} ` +
      `кадров: ${count} ${problems.join("; ")}`,
  );
  await ctx.close();
}

await browser.close();
console.log(bad === 0 ? "\nУвеличенный кадр помещается во всех окнах." : `\nПроблем: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
