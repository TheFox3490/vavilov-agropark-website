/* Сколько картинок тянет каждая страница. Появилась после того, как
   выяснилось, что главная грузила 3.6 МБ: фотография проекта весила 1.4 МБ
   при слоте 531×366, а фон первого экрана — 1.1 МБ.

   Запуск:  node tools/page-weight.mjs
*/
import { chromium } from "playwright";

const B = process.argv[2] ?? "http://localhost:8080";
const PAGES = ["/", "/news", "/projects", "/projects/vr-tehnum", "/services", "/team"];

const browser = await chromium.launch();
let worst = 0;

for (const path of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const seen = new Map();
  page.on("response", (r) => {
    const type = r.headers()["content-type"] ?? "";
    if (!type.startsWith("image/")) return;
    seen.set(new URL(r.url()).pathname, Number(r.headers()["content-length"] ?? 0));
  });
  await page.goto(B + path, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const total = [...seen.values()].reduce((s, n) => s + n, 0) / 1024;
  worst = Math.max(worst, total);
  const heaviest = [...seen.entries()].sort((a, b) => b[1] - a[1])[0];
  console.log(
    `${path.padEnd(22)} картинок: ${String(seen.size).padStart(2)}  ` +
      `вес: ${total.toFixed(0).padStart(5)} КБ  самая тяжёлая: ` +
      `${heaviest ? `${(heaviest[1] / 1024).toFixed(0)} КБ ${heaviest[0]}` : "—"}`,
  );
  await page.close();
}

await browser.close();
console.log(`\nСамая тяжёлая страница: ${worst.toFixed(0)} КБ картинок.`);
