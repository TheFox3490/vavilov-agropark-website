/* Проверка карусели проектов на первом экране.

   Карточки приходят из базы, поэтому проверяем не только вёрстку: совпадает ли
   состав с тем, что отдаёт API, идут ли номера подряд, ведёт ли карточка
   на свой проект и срабатывают ли запасные варианты кадра.

   Запуск:  node tools/hero-slider.mjs
*/
import { chromium, devices } from "playwright";

const B = "http://localhost:8080";

const WINDOWS = [
  { n: "1920x1080", w: 1920, h: 1080, m: false, note: "монитор 1080p" },
  { n: "1536x760", w: 1536, h: 760, m: false, note: "1080p при масштабе Windows 125%" },
  { n: "1366x660", w: 1366, h: 660, m: false, note: "бюджетный ноутбук" },
  { n: "414x896", w: 414, h: 896, m: true, note: "iPhone XR" },
  { n: "344x882", w: 344, h: 882, m: true, note: "Galaxy Fold" },
];

const expected = await fetch(`${B}/api/projects?placement=slider`)
  .then((r) => r.json())
  .then((d) => d.items);
console.log(`в карусели по данным API: ${expected.length}\n`);

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
  await page.goto(B, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  const problems = [];

  const cards = await page.evaluate(() =>
    [...document.querySelectorAll(".hero-card")].map((card) => ({
      num: card.querySelector(".hero-card__num")?.textContent ?? "",
      kind: card.querySelector(".hero-card__kind")?.textContent ?? "",
      name: card.querySelector(".hero-card__name")?.textContent ?? "",
      href: card.getAttribute("href"),
      image: card.querySelector("img")?.getAttribute("src") ?? null,
    })),
  );

  if (cards.length !== expected.length)
    problems.push(`карточек ${cards.length}, в API ${expected.length}`);

  // Номера идут подряд, без дыр — иначе после удаления проекта они разъедутся.
  const numbers = cards.map((c) => c.num).join(",");
  const wanted = expected.map((_, i) => String(i + 1).padStart(2, "0")).join(",");
  if (numbers !== wanted) problems.push(`номера «${numbers}», ожидались «${wanted}»`);

  cards.forEach((card, i) => {
    const item = expected[i];
    if (!item) return;
    if (card.name !== item.slider_title)
      problems.push(`карточка ${i + 1}: имя «${card.name}» вместо «${item.slider_title}»`);
    if (card.href !== `/startups/${item.slug}`)
      problems.push(`карточка ${i + 1} ведёт на ${card.href}`);
    // Запасные варианты кадра: что-то показать обязаны всегда, если у проекта
    // есть хоть одна картинка.
    if (item.card_image && !card.image) problems.push(`карточка ${i + 1} без кадра`);
  });

  // Стрелка листает трек
  const scrolled = await page.evaluate(async () => {
    const track = document.querySelector(".hero__track");
    const before = track.scrollLeft;
    document.querySelector(".hero__nav--next").click();
    await new Promise((r) => setTimeout(r, 600));
    return track.scrollLeft - before;
  });
  if (scrolled <= 0) problems.push("стрелка не листает");

  // Переход по карточке
  await page.locator(".hero-card").first().click();
  await page.waitForTimeout(800);
  const path = new URL(page.url()).pathname;
  if (path !== `/startups/${expected[0].slug}`) problems.push(`переход привёл на ${path}`);

  if (problems.length) bad++;
  console.log(
    `${problems.length ? "✗" : "✓"} ${win.n.padEnd(10)} ${win.note.padEnd(34)} ` +
      `карточек: ${cards.length} ${problems.join("; ")}`,
  );
  await ctx.close();
}

await browser.close();
console.log(bad === 0 ? "\nКарусель первого экрана работает." : `\nПроблем: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
