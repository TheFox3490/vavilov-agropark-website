/* Что видит поисковый робот и мессенджер — и что видит человек.

   Первая половина проверки обходится без браузера: страницы забираются
   как есть, без выполнения JavaScript, — именно так их читают Telegram,
   ВКонтакте и поисковики. Вторая проверяет то, что должно работать
   в браузере: адреса новостей и заголовок вкладки при переходах.

   Заголовок, описание и картинка должны различаться от страницы к странице
   и совпадать с содержимым базы.

   Запуск:  node tools/seo-check.mjs [базовый-URL]
*/
const B = process.argv[2] ?? "http://localhost:8080";

const problems = [];
const seen = new Map();

const grab = async (path) => {
  const html = await fetch(B + path).then((r) => r.text());
  const pick = (re) => (html.match(re)?.[1] ?? null);
  return {
    title: pick(/<title>([^<]*)<\/title>/),
    description: pick(/<meta name="description" content="([^"]*)"/),
    ogTitle: pick(/<meta property="og:title" content="([^"]*)"/),
    ogImage: pick(/<meta property="og:image" content="([^"]*)"/),
    canonical: pick(/<link rel="canonical" href="([^"]*)"/),
    noindex: /name="robots" content="noindex/.test(html),
  };
};

// Страницы, у каждой из которых должен быть свой заголовок
const news = await fetch(`${B}/api/news?limit=1`).then((r) => r.json());
const project = await fetch(`${B}/api/projects`).then((r) => r.json());
const service = await fetch(`${B}/api/services`).then((r) => r.json());

/* На чистой установке ленты новостей ещё нет — проверять её адрес нечего.
   Разделы каталога заполняет сидер, они есть всегда. */
const cases = [
  ["/", null],
  ["/news", null],
  ["/startups", null],
  ["/services", null],
  ["/contacts", null],
  ["/privacy", null],
  ...(news.items.length ? [[`/news/${news.items[0].id}`, news.items[0].title]] : []),
  [`/startups/${project.items[0].slug}`, project.items[0].title],
  [`/services/${service.items[0].slug}`, service.items[0].title],
];
if (!news.items.length) console.log("  (новостей нет — адрес новости не проверяется)");

for (const [path, expected] of cases) {
  const meta = await grab(path);
  if (!meta.title) problems.push(`${path}: нет заголовка`);
  if (!meta.description) problems.push(`${path}: нет описания`);
  if (!meta.ogTitle || !meta.ogImage) problems.push(`${path}: нет карточки ссылки`);
  if (meta.canonical !== B + path) problems.push(`${path}: canonical ${meta.canonical}`);
  if (expected && !meta.title.includes(expected))
    problems.push(`${path}: в заголовке нет названия записи «${expected}»`);
  if (seen.has(meta.title)) problems.push(`${path}: заголовок повторяет ${seen.get(meta.title)}`);
  seen.set(meta.title, path);
  console.log(`  ${path.padEnd(28)} ${meta.title}`);
}

// Личные разделы роботам не нужны
for (const path of ["/admin", "/login"]) {
  const meta = await grab(path);
  if (!meta.noindex) problems.push(`${path}: не закрыт от индексации`);
}

// Снятое с публикации не должно раскрываться заголовком
const draft = await grab("/startups/такого-нет");
if (draft.canonical?.includes("такого-нет") && draft.title.includes("—") === false)
  problems.push("несуществующий адрес отдаёт непонятную голову");

import { chromium } from "playwright";

// --- Поведение в браузере: адреса новостей и заголовок вкладки ---
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// 1. Прямой заход по адресу новости открывает её поверх ленты
const id = news.items[0]?.id;
if (id) {
await page.goto(`${B}/news/${id}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
if (!(await page.locator(".modal__title").count())) problems.push("по прямому адресу новость не открылась");

// 2. Закрытие возвращает на ленту
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
if (new URL(page.url()).pathname !== "/news") problems.push(`после закрытия адрес ${new URL(page.url()).pathname}`);

// 3. Открытие из ленты не прокручивает страницу наверх
await page.evaluate(() => window.scrollTo(0, 700));
await page.waitForTimeout(300);
const before = await page.evaluate(() => window.scrollY);
await page.locator(".news-card").first().click();
await page.waitForTimeout(800);
const after = await page.evaluate(() => window.scrollY);
if (Math.abs(after - before) > 20) problems.push(`лента уехала при открытии: ${before} → ${after}`);
if (!new URL(page.url()).pathname.startsWith("/news/")) problems.push("адрес не сменился при открытии");

}

// 4. Заголовок вкладки меняется при переходах
await page.goto(`${B}/news`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await page.click('a[href="/startups"]');
await page.waitForTimeout(900);
const title = await page.title();
if (!title.startsWith("Наши стартапы")) problems.push(`заголовок вкладки после перехода: ${title}`);

await browser.close();

const robots = await fetch(`${B}/robots.txt`).then((r) => r.text());
if (!robots.includes("Sitemap:")) problems.push("в robots.txt нет ссылки на карту сайта");
if (!robots.includes("Disallow: /admin/")) problems.push("в robots.txt открыт /admin");

const sitemap = await fetch(`${B}/sitemap.xml`).then((r) => r.text());
const count = (sitemap.match(/<url>/g) ?? []).length;
const expectedCount = 7 + news.items.length + project.items.length + service.items.length;
if (!sitemap.includes(`/startups/${project.items[0].slug}`))
  problems.push("в карте сайта нет страницы проекта");
if (news.items.length && !sitemap.includes(`/news/${news.items[0].id}`))
  problems.push("в карте сайта нет новости");

console.log(`\n  robots.txt: есть, карта сайта: ${count} адресов`);
console.log(
  problems.length
    ? `\n✗ Проблем: ${problems.length}\n  ${problems.join("\n  ")}`
    : "\n✓ У каждой страницы своя голова, карта сайта и robots.txt на месте.",
);
process.exit(problems.length ? 1 : 0);
