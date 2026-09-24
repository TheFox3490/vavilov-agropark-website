/* Картинка в открытой новости: целиком, без обрезки, и раскрывается во весь экран.

   Раньше картинка тянулась на всю ширину окна и обрезалась по высоте —
   у вертикальных фотографий пропадали головы, у афиш надписи.

   Базу проверка не трогает: у существующей новости она прямо в браузере
   подменяет картинку на заведомо вертикальную или горизонтальную (рисунок
   SVG с известными пропорциями).

   Что проверяется:
   - пропорции на экране совпадают с пропорциями файла — значит, не обрезано;
   - горизонтальная во всю ширину, если не упёрлась в потолок по высоте;
     любая — не выше потолка;
   - нажатие открывает просмотр, и кадр в нём помещается в экран;
   - Esc и клик мимо кадра закрывают только просмотр, окно новости остаётся —
     оба окна слушают Esc, и без перехвата закрылись бы разом.

   Запуск:  node tools/news-image.mjs
*/

import { chromium } from "playwright";

const B = "http://localhost:8080";
const browser = await chromium.launch();
const problems = [];

const feed = await fetch(`${B}/api/news?limit=1`).then((r) => r.json());
const id = feed.items?.[0]?.id;
if (!id) {
  console.log("✗ В базе нет ни одной новости — проверять не на чем.");
  process.exit(1);
}

const svg = (w, h, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  `<rect width="100%" height="100%" fill="#2a6fd6"/>` +
  // Рамка по краю: будь картинка обрезана, её бы не было видно.
  `<rect x="4" y="4" width="${w - 8}" height="${h - 8}" fill="none" stroke="#ff2d8a" stroke-width="8"/>` +
  `<text x="50%" y="50%" font-size="${Math.round(w / 8)}" fill="#fff" text-anchor="middle">${label}</text></svg>`;

const SHAPES = {
  vertical: { w: 600, h: 1200 },
  horizontal: { w: 1600, h: 900 },
};

async function run(kind, viewport, device) {
  const { w, h } = SHAPES[kind];
  const label = `${device}, ${kind === "vertical" ? "вертикальная" : "горизонтальная"}`;
  const context = await browser.newContext({ viewport, ...(device === "телефон" ? { isMobile: true, hasTouch: true } : {}) });
  const page = await context.newPage();

  await page.route(`**/api/news/${id}`, async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.item.image_url = `/__test/${kind}.svg`;
    await route.fulfill({ response, json: data });
  });
  await page.route(`**/__test/${kind}.svg`, (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg(w, h, kind) }),
  );

  await page.goto(`${B}/news/${id}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".modal__image");
  await page.waitForFunction(() => document.querySelector(".modal__image")?.complete);
  await page.waitForTimeout(300);

  const box = await page.evaluate(() => {
    const img = document.querySelector(".modal__image");
    const r = img.getBoundingClientRect();
    // Ширина места под картинку — это кнопка-рамка, а не окно целиком:
    // у окна свои внутренние отступы.
    const frame = document.querySelector(".modal__figure").getBoundingClientRect();
    const cap = parseFloat(getComputedStyle(img).maxHeight);
    return { w: r.width, h: r.height, fit: getComputedStyle(img).objectFit, frameW: frame.width, cap, vh: innerHeight };
  });

  const ratioShown = box.w / box.h;
  const ratioFile = w / h;
  if (Math.abs(ratioShown - ratioFile) > 0.02) {
    problems.push(`${label}: пропорции ${ratioShown.toFixed(2)} вместо ${ratioFile.toFixed(2)} — картинка обрезана или искажена`);
  }
  if (box.fit === "cover") problems.push(`${label}: object-fit: cover — края обрезаются`);
  // Горизонтальная — во всю ширину, если только не упёрлась в потолок по высоте:
  // тогда она уже, но зато заголовок новости остаётся на экране.
  const fullWidth = box.w >= box.frameW - 2;
  const atCap = box.h >= box.cap - 2;
  if (kind === "horizontal" && !fullWidth && !atCap) {
    problems.push(`${label}: занимает ${Math.round(box.w)}px из ${Math.round(box.frameW)}px, хотя в высоту есть запас`);
  }
  if (box.h > box.cap + 1) problems.push(`${label}: высота ${Math.round(box.h)}px — выше потолка ${Math.round(box.cap)}px`);

  // Просмотр во весь экран
  await page.click(".modal__figure");
  await page.waitForSelector(".lightbox__img");
  await page.waitForTimeout(200);
  const zoom = await page.evaluate(() => {
    const r = document.querySelector(".lightbox__img").getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight };
  });
  if (zoom.top < 0 || zoom.left < 0 || zoom.bottom > zoom.vh + 1 || zoom.right > zoom.vw + 1) {
    problems.push(`${label}: в просмотре кадр не помещается в экран`);
  }

  // Esc закрывает только просмотр
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const afterEsc = await page.evaluate(() => ({
    lightbox: !!document.querySelector(".lightbox"),
    modal: !!document.querySelector(".modal"),
  }));
  if (afterEsc.lightbox) problems.push(`${label}: Esc не закрыл просмотр`);
  if (!afterEsc.modal) problems.push(`${label}: Esc закрыл вместе с просмотром и саму новость`);

  // Клик мимо кадра закрывает только просмотр
  await page.click(".modal__figure");
  await page.waitForSelector(".lightbox");
  await page.mouse.click(8, zoom.vh - 8);
  await page.waitForTimeout(250);
  const afterClick = await page.evaluate(() => ({
    lightbox: !!document.querySelector(".lightbox"),
    modal: !!document.querySelector(".modal"),
  }));
  if (afterClick.lightbox) problems.push(`${label}: клик мимо кадра не закрыл просмотр`);
  if (!afterClick.modal) problems.push(`${label}: клик мимо кадра закрыл и саму новость`);

  // И обычный Esc после этого закрывает новость, как и раньше
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  if (await page.$(".modal")) problems.push(`${label}: Esc без просмотра не закрыл новость`);

  const why = fullWidth ? "во всю ширину" : atCap ? "упёрлась в потолок по высоте" : "";
  console.log(`  ${label}: ${Math.round(box.w)}×${Math.round(box.h)}px, пропорции ${ratioShown.toFixed(2)} (файл ${ratioFile.toFixed(2)}) — ${why}`);
  await context.close();
}

console.log(`Новость №${id}`);
for (const [device, viewport] of [
  ["ПК", { width: 1536, height: 730 }], // 1920×1080 при масштабе Windows 125%
  ["телефон", { width: 390, height: 745 }],
]) {
  for (const kind of ["vertical", "horizontal"]) await run(kind, viewport, device);
}

await browser.close();
console.log(
  problems.length
    ? `\n✗ Проблем: ${problems.length}\n  ${problems.join("\n  ")}`
    : "\n✓ Картинка новости показывается целиком и раскрывается во весь экран.",
);
process.exit(problems.length ? 1 : 0);
