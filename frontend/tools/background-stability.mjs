/* Стоит ли фон на месте, пока посетитель листает страницу.

   Фон — слой 3D-объектов (components/Shapes.jsx). Прежний алгоритм
   перестраивал его целиком в трёх ситуациях, и все три здесь воспроизведены:

   A. Телефон, прокрутка. Адресная строка браузера прячется и возвращается,
      высота окна меняется на 70–80px. Эмулируем сменой высоты окна.
   B. Страница удлинилась: подгрузились новости, открылся блок. Эмулируем
      вставкой блока в ленту.
   C. Первая загрузка на медленной сети: сначала приходит пустая страница,
      потом шрифты, потом данные из API.

   Правило одно: объект, который уже стоит на странице, не должен сдвинуться
   ни на пиксель (допуск 2px). Появляться и исчезать объекты могут только
   в хвосте — там, куда дотянулась или откуда ушла страница.

   Запуск:  node tools/background-stability.mjs          действующий режим
            node tools/background-stability.mjs legacy   прежний — для сравнения,
                                                         на нём проверка падает
*/

import { chromium } from "playwright";

const B = "http://localhost:8080";
const MODE = process.argv[2] ?? "stable";
const browser = await chromium.launch();
let failures = 0;

const PHONE = { viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };
const DESKTOP = { viewport: { width: 1440, height: 900 } };

// Положение объектов в координатах страницы, по порядку номеров.
const snapshot = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".shape")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        // Центр, а не верх: объект сдвинут на половину своего размера
        // (translate -50%), и пока картинка не загрузилась, её высота нулевая.
        // Верх при загрузке съехал бы вверх, центр остаётся на месте.
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + scrollY + r.height / 2),
      };
    }),
  );

// Сколько уже стоявших объектов сдвинулось и насколько.
function compare(before, after) {
  const common = Math.min(before.length, after.length);
  let moved = 0;
  let worst = 0;
  for (let i = 0; i < common; i++) {
    const d = Math.hypot(before[i].x - after[i].x, before[i].y - after[i].y);
    if (d > 2) {
      moved++;
      worst = Math.max(worst, Math.round(d));
    }
  }
  return { moved, worst, count: `${before.length}→${after.length}` };
}

function report(label, result) {
  const ok = result.moved === 0;
  if (!ok) failures++;
  const tail = ok
    ? `объектов ${result.count}, стоявшие на месте`
    : `сдвинулось ${result.moved}, до ${result.worst}px (объектов ${result.count})`;
  console.log(`  ${ok ? "✓" : "✗"} ${label} — ${tail}`);
}

async function open(options, path) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  // Режим задаётся параметром в адресе — так же, как его переключают
  // для сверки на настоящем телефоне.
  await page.goto(`${B}${path}?shapes=${MODE}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);
  const mode = await page.evaluate(() => document.querySelector(".shapes")?.dataset.mode);
  if (mode !== MODE) throw new Error(`на странице режим «${mode}», а ожидался «${MODE}»`);
  return { context, page };
}

console.log(`Режим фона: ${MODE}\n`);

// --- A. Адресная строка на телефоне ----------------------------------------
console.log("A. Телефон: адресная строка прячется и возвращается");
for (const path of ["/", "/news", "/projects", "/team"]) {
  const { context, page } = await open(PHONE, path);
  const start = await snapshot(page);
  await page.setViewportSize({ width: 390, height: 745 });
  await page.waitForTimeout(400);
  const hidden = await snapshot(page);
  await page.setViewportSize({ width: 390, height: 664 });
  await page.waitForTimeout(400);
  const back = await snapshot(page);
  report(`${path.padEnd(9)} строка спряталась`, compare(start, hidden));
  report(`${path.padEnd(9)} строка вернулась `, compare(hidden, back));
  await context.close();
}

// --- B. Страница удлинилась ------------------------------------------------
console.log("\nB. Страница удлинилась");
for (const [label, options] of [["ПК", DESKTOP], ["телефон", PHONE]]) {
  for (const grow of [30, 200, 900]) {
    const { context, page } = await open(options, "/news");
    const before = await snapshot(page);
    await page.evaluate((g) => {
      const block = document.createElement("div");
      block.style.height = `${g}px`;
      document.querySelector(".news__grid").after(block);
    }, grow);
    await page.waitForTimeout(600);
    report(`${label.padEnd(8)} +${grow}px`, compare(before, await snapshot(page)));
    await context.close();
  }
}

// --- C. Первая загрузка на медленной сети ----------------------------------
console.log("\nC. Первая загрузка, мобильный интернет");
for (const path of ["/", "/news", "/projects", "/team"]) {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  // Задержка 300 мс на запрос, около 1,5 Мбит/с.
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 300,
    downloadThroughput: 190000,
    uploadThroughput: 90000,
  });
  await page.goto(`${B}${path}?shapes=${MODE}`, { waitUntil: "commit" });

  let previous = [];
  let moved = 0;
  let worst = 0;
  let elapsed = 0;
  for (const t of [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6500, 8000]) {
    await page.waitForTimeout(t - elapsed);
    elapsed = t;
    const current = await snapshot(page).catch(() => []);
    const d = compare(previous, current);
    moved += d.moved;
    worst = Math.max(worst, d.worst);
    previous = current;
  }
  report(`${path.padEnd(9)} за 8 с`, { moved, worst, count: `→${previous.length}` });
  await context.close();
}

await browser.close();
console.log(
  failures === 0
    ? "\nГотово: фон стоит на месте во всех сценариях."
    : `\nФон сдвигался в ${failures} сценариях.`,
);
process.exit(failures === 0 ? 0 : 1);
