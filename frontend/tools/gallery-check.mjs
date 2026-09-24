/* Проверка галереи проекта: переключение кадров, лента миниатюр,
   увеличение во весь экран — на пяти размерах экрана.

   Нужен проект с галереей: без дополнительных кадров лента не рисуется,
   и проверять нечего. Адрес проекта задаётся вторым аргументом.

   Запуск:  node tools/gallery-check.mjs [адрес-проекта]
*/
import { chromium, devices } from "playwright";

const B = "http://localhost:8080";
const SLUG = process.argv[2] ?? "vr-tehnum";
const VPS = [
  { n: "galaxy-fold", w: 344, h: 882, m: true },
  { n: "iphone-se", w: 375, h: 667, m: true },
  { n: "iphone-xr", w: 414, h: 896, m: true },
  { n: "ipad", w: 820, h: 1180, m: true },
  { n: "desktop", w: 1440, h: 900, m: false },
];
// Обложка считается таким же кадром, как остальные, поэтому ожидаемое
// число миниатюр — галерея плюс единица, если обложка задана.
const item = await fetch(`${B}/api/projects/${SLUG}`).then((r) => r.json()).then((d) => d.item);
const expected = item.images.length + (item.image_url ? 1 : 0);
if (expected < 2) {
  console.log(`У проекта «${item.title}» нет дополнительных кадров — проверять нечего.`);
  process.exit(0);
}

const browser = await chromium.launch();
let bad = 0;

for (const vp of VPS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2,
    isMobile: vp.m, hasTouch: vp.m, userAgent: vp.m ? devices["iPhone 12"].userAgent : undefined,
  });
  const page = await ctx.newPage();
  await page.goto(`${B}/projects/${SLUG}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const problems = [];

  // Страница не должна сама уезжать к галерее: заголовок обязан остаться виден.
  const scrolledOnLoad = await page.evaluate(() => window.scrollY);
  if (scrolledOnLoad > 4) problems.push(`страница уехала вниз на ${Math.round(scrolledOnLoad)}px при загрузке`);
  const stage0 = await page.getAttribute(".gallery__stage img", "src");
  const thumbs = await page.locator(".gallery__thumb").count();
  // Лента = обложка плюс кадры галереи. Без кадров её вообще нет,
  // и проверять нечего — об этом лучше сказать прямо, а не падать таймаутом.
  if (thumbs < 3) {
    console.log(
      `У проекта «${SLUG}» ${thumbs === 0 ? "нет галереи" : "слишком мало кадров"}. ` +
        "Добавьте в админке хотя бы два кадра или укажите другой адрес проекта:\n" +
        "  node tools/gallery-check.mjs адрес-проекта",
    );
    await ctx.close();
    await browser.close();
    process.exit(2);
  }

  // Переключение на третий кадр
  await page.locator(".gallery__thumb").nth(2).click();
  await page.waitForTimeout(400);
  const stage1 = await page.getAttribute(".gallery__stage img", "src");
  if (stage1 === stage0) problems.push("крупный кадр не сменился");
  const activeIdx = await page.evaluate(() =>
    [...document.querySelectorAll(".gallery__thumb")].findIndex((t) => t.classList.contains("gallery__thumb--active")));
  if (activeIdx !== 2) problems.push(`подсвечена миниатюра ${activeIdx}, ожидалась 2`);

  // Прежний крупный кадр остался в ленте — ничего не пропало
  // Сравниваем пути, а не src: у атрибута путь относительный, у свойства — полный.
  const inStrip = await page.evaluate((src) =>
    [...document.querySelectorAll(".gallery__thumb img")]
      .some((i) => new URL(i.src, location.href).pathname === new URL(src, location.href).pathname), stage0);
  if (!inStrip) problems.push("прежний крупный кадр исчез из ленты");

  // Картинка вписана целиком, не обрезана
  const fit = await page.evaluate(() => {
    const img = document.querySelector(".gallery__stage img");
    const box = img.getBoundingClientRect();
    return {
      fit: getComputedStyle(img).objectFit,
      inside: img.naturalWidth > 0 &&
        Math.abs(box.width / box.height - 16 / 9) < 0.2,
    };
  });
  if (fit.fit !== "contain") problems.push(`object-fit ${fit.fit}`);

  // Увеличение во весь экран. Подробно размеры проверяет lightbox-fit.mjs,
  // здесь — что просмотрщик вообще открывается и закрывается.
  await page.click(".gallery__stage");
  await page.waitForTimeout(500);
  const zoom = await page.evaluate(() => {
    const img = document.querySelector(".lightbox__img");
    if (!img) return null;
    const b = img.getBoundingClientRect();
    return { visible: b.width > 0 && b.height > 0, right: b.right, bottom: b.bottom, w: innerWidth, h: innerHeight };
  });
  if (!zoom?.visible) problems.push("окно во весь экран не открылось");
  else if (zoom.right > zoom.w + 1 || zoom.bottom > zoom.h + 1) problems.push("увеличенный кадр вылезает за экран");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  if (await page.locator(".lightbox").count()) problems.push("окно не закрылось по Escape");

  // Горизонтальной прокрутки страницы быть не должно: лента прокручивается сама
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (overflow) problems.push("страница прокручивается вбок");

  const stripScrolls = await page.evaluate(() => {
    const s = document.querySelector(".gallery__strip");
    return s.scrollWidth > s.clientWidth + 1;
  });

  // Снимок делаем от начала страницы: клики Playwright по нижним миниатюрам
  // сами прокручивают окно, и без возврата наверх кадр выходит смазанным.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `../figma-export/shots/gallery-${vp.n}.png`, fullPage: true });
  if (problems.length) bad++;
  console.log(`${problems.length ? "✗" : "✓"} ${vp.n.padEnd(12)} миниатюр: ${thumbs}, лента ${stripScrolls ? "прокручивается" : "влезает"} ${problems.join("; ")}`);
  await ctx.close();
}

await browser.close();
console.log(bad ? `\nПроблем: ${bad}` : "\nГалерея работает на всех размерах.");
process.exit(bad ? 1 : 0);
