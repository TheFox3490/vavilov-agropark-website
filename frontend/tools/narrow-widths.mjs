/* Ищет вёрстку, которая разъезжается на узких экранах.

   Две разные беды, и вторую обычные проверки не видят.

   1. Страница шире экрана — появляется горизонтальная прокрутка.
   2. Блок шире своего места, но обрезан краем (overflow: hidden). Прокрутки
      не возникает, страница выглядит целой — просто у карточки отрезан бок,
      а у заголовка хвост слова. Ловится сравнением scrollWidth с clientWidth.

   Так вылезала сетка новостей: минимальный трек 17rem = 272px, а на узкой
   странице колонке доставалось 240px, и карточка торчала за панель. На
   iPhone во «Увеличенном» режиме экрана (Настройки → Дисплей и яркость →
   Вид) ширина падает до такого класса — в эмуляторе такого не бывает.

   Ширины взяты по классам CSS-виджета iOS: 320 — «Увеличенный» режим на
   компактных моделях, 390/414/430 — обычные.

   Запуск:  node tools/narrow-widths.mjs [адрес]
*/

import { chromium, webkit } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:8080";
const WIDTHS = [320, 360, 375, 390, 414, 430];

/* WebKit — тот самый движок, что стоит на всех iPhone, поэтому берём его,
   когда он установлен. Если системных библиотек нет, работаем на Chromium:
   переполнение блоков он считает так же, разойтись движки могут только
   в мелочах шрифтовых метрик. */
let engine = webkit;
let engineName = "WebKit (движок Safari)";
try {
  const probe = await webkit.launch();
  await probe.close();
} catch {
  engine = chromium;
  engineName = "Chromium — WebKit не установлен (sudo npx playwright install-deps webkit)";
}

const browser = await engine.launch();
let failures = 0;

// Список страниц: статичные плюс по одной карточке проекта и услуги.
const pages = [
  "/",
  "/news",
  "/projects",
  "/services",
  "/team",
  "/privacy",
  "/consent",
  // Формы входа и регистрации проверяются наравне с остальным: у них свои
  // широкие элементы (кнопка отправки с min-width), и первый раз именно их
  // в списке не хватило — переполнение нашлось на живом телефоне, а не тут.
  "/login",
  "/register",
];
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  for (const [listing, prefix] of [["/projects", "/projects/"], ["/services", "/services/"]]) {
    await page.goto(`${BASE}${listing}`, { waitUntil: "domcontentloaded" });
    // Список приходит запросом к API, поэтому ждём появления самих ссылок:
    // без этого разбор находил пустую страницу и карточки не проверялись.
    await page
      .waitForSelector(`a[href*="${prefix}"]`, { timeout: 10000 })
      .catch(() => console.log(`  (карточек в разделе ${listing} нет — пропускаю)`));
    const href = await page.evaluate((p) => {
      const link = [...document.querySelectorAll("a[href]")].find((a) =>
        new URL(a.href).pathname.startsWith(p) && new URL(a.href).pathname !== p.slice(0, -1),
      );
      return link ? new URL(link.href).pathname : null;
    }, prefix);
    if (href) pages.push(href);
  }
  await context.close();
}

console.log(`Движок: ${engineName}`);
console.log(`Страницы: ${pages.join(", ")}\n`);

/* Элементы, которым прокрутка положена по замыслу: лента миниатюр в галерее
   и всё, что явно помечено прокручиваемым. Их пропускаем. */
function scanClipped() {
  const bad = [];
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls =
      typeof el.className === "string" && el.className
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
        : "";
    return el.tagName.toLowerCase() + id + cls;
  };
  for (const el of document.querySelectorAll("body *")) {
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") continue;
    // Прокручиваемым по замыслу переполнение положено — это не поломка.
    if (st.overflowX === "auto" || st.overflowX === "scroll") continue;
    // Декоративный слой (фоновые пятна) намеренно шире экрана и обрезается.
    if (el.closest('[aria-hidden="true"]')) continue;
    // Пустым элементам обрезать нечего: у точек-индикаторов переполнение
    // даёт лишь браузерный отступ кнопки по умолчанию, содержимого там нет.
    if (el.children.length === 0 && el.textContent.trim() === "") continue;

    const over = el.scrollWidth - el.clientWidth;
    if (over > 1) bad.push({ el: describe(el), over, w: el.clientWidth });
  }
  return bad;
}

for (const path of pages) {
  console.log(`${path}`);
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 780 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);

    const doc = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    const clipped = await page.evaluate(scanClipped);

    const problems = [];
    if (doc.scroll > doc.client + 1) {
      problems.push(`страница шире экрана на ${doc.scroll - doc.client}px`);
    }
    for (const c of clipped.slice(0, 5)) {
      problems.push(`${c.el} обрезан: содержимое ${c.w + c.over}px в поле ${c.w}px`);
    }

    if (problems.length === 0) {
      console.log(`  ✓ ${width}px`);
    } else {
      failures += problems.length;
      console.log(`  ✗ ${width}px`);
      for (const p of problems) console.log(`      ${p}`);
    }

    await context.close();
  }
}

/* Значок меню. Полоски бургера — пустые <span> внутри <button>, и ширину им
   нужно задавать явно: в WebKit до 17-й версии флекс-потомки кнопки не
   растягиваются по контейнеру, полоски выходили нулевой ширины. Кнопка при
   этом занимала место и нажималась, поэтому проверка «меню открывается»
   такое пропускала — смотреть надо именно на размер полосок.

   На Chromium этот прогон зелёный в любом случае: баг WebKit-овский. Ценность
   появляется, когда установлен WebKit (см. заголовок файла). */
{
  console.log("\nЗначок меню (бургер)");
  const context = await browser.newContext({
    viewport: { width: 375, height: 780 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  const bars = await page.evaluate(() => {
    const burger = document.querySelector(".burger");
    if (!burger) return null;
    return {
      shown: getComputedStyle(burger).display !== "none",
      sizes: [...burger.querySelectorAll("span")].map((s) => ({
        w: Math.round(s.getBoundingClientRect().width),
        h: Math.round(s.getBoundingClientRect().height),
      })),
    };
  });

  if (!bars) {
    failures++;
    console.log("  ✗ кнопки меню нет в разметке");
  } else if (!bars.shown) {
    failures++;
    console.log("  ✗ кнопка меню скрыта на мобильной ширине");
  } else {
    const bad = bars.sizes.filter((s) => s.w < 10 || s.h < 1);
    if (bad.length > 0) {
      failures++;
      console.log(`  ✗ полоски нулевой ширины: ${JSON.stringify(bars.sizes)}`);
    } else {
      console.log(`  ✓ три полоски видны (${bars.sizes.map((s) => `${s.w}×${s.h}`).join(", ")})`);
    }
  }

  await context.close();
}

await browser.close();

console.log(
  failures === 0
    ? "\nГотово: на всех проверенных ширинах вёрстка держится."
    : `\nНайдено проблем: ${failures}.`,
);
process.exit(failures === 0 ? 0 : 1);
