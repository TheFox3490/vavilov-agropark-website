/* Проверка блока «Наши проекты» на главной: карусель по проектам из базы.

   Проверяется, что блок помещается в окно (на 1080p при масштабе Windows 125%
   портретная карточка раньше не влезала), что боковые карточки переключают
   центральную, что центральная ведёт на страницу проекта, и что на узком
   экране вместо боковых карточек работают точки.

   Запуск:  node tools/projects-block.mjs
*/
import { chromium, devices } from "playwright";

const B = "http://localhost:8080";
const WINDOWS = [
  { n: "1536x760", w: 1536, h: 760, m: false, note: "1080p при масштабе Windows 125%" },
  { n: "1536x864", w: 1536, h: 864, m: false, note: "то же во весь экран" },
  { n: "1920x960", w: 1920, h: 960, m: false, note: "монитор 1080p" },
  { n: "1366x660", w: 1366, h: 660, m: false, note: "бюджетный ноутбук" },
  { n: "820x1180", w: 820, h: 1180, m: true, note: "iPad" },
  { n: "414x896", w: 414, h: 896, m: true, note: "iPhone XR" },
  { n: "344x882", w: 344, h: 882, m: true, note: "Galaxy Fold" },
];

const total = await fetch(`${B}/api/projects?placement=featured`)
  .then((r) => r.json())
  .then((d) => d.items.length);
console.log(`проектов в блоке: ${total}\n`);

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
  const narrow = win.w <= 900;

  await page.locator(".projects").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const box = await page.evaluate(() => {
    const block = document.querySelector(".projects");
    const card = document.querySelector(".projects__featured");
    const b = block.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return {
      блок: Math.round(b.height),
      карточка: `${Math.round(c.width)}×${Math.round(c.height)}`,
      картаВлезает: c.height <= innerHeight,
      блокВлезает: b.height <= innerHeight,
      окно: innerHeight,
    };
  });
  if (!box.картаВлезает) problems.push(`карточка выше окна: ${box.карточка} при ${box.окно}`);

  // Симметрия: центральная карточка должна быть крупнее боковых и стоять
  // ровно посередине. Раньше потолок высоты мешал ей заполнить свою колонку,
  // она прижималась к левому краю и оказывалась уже боковых.
  if (!narrow) {
    const geo = await page.evaluate(() => {
      const c = document.querySelector(".projects__featured").getBoundingClientRect();
      const s = [...document.querySelectorAll(".projects__side")].map((e) => e.getBoundingClientRect());
      return {
        centerW: c.width,
        sideW: s[0].width,
        left: Math.round(c.left - s[0].right),
        right: Math.round(s[1].left - c.right),
      };
    });
    if (Math.abs(geo.left - geo.right) > 2)
      problems.push(`зазоры разные: слева ${geo.left}, справа ${geo.right}`);
    if (geo.centerW <= geo.sideW)
      problems.push(`центральная карточка не крупнее боковых: ${Math.round(geo.centerW)} против ${Math.round(geo.sideW)}`);
  }

  const dots = await page.locator(".projects__dot").count();
  const sidesVisible = await page.locator(".projects__side").evaluateAll((els) =>
    els.filter((e) => getComputedStyle(e).display !== "none").length,
  );
  if (dots !== total) problems.push(`точек ${dots}, проектов ${total}`);
  if (narrow && sidesVisible !== 0) problems.push(`на узком экране видны боковые карточки (${sidesVisible})`);
  if (!narrow && sidesVisible !== 2) problems.push(`на широком экране боковых карточек ${sidesVisible}, ожидалось 2`);

  // Переключение: на широком — боковой карточкой, на узком — точкой
  const before = await page.locator(".projects__badge").textContent();
  if (narrow) await page.locator(".projects__dot").nth(1).click();
  else await page.locator(".projects__side").last().click();
  await page.waitForTimeout(400);
  const after = await page.locator(".projects__badge").textContent();
  if (before === after) problems.push("центральная карточка не сменилась");

  const activeDot = await page.evaluate(() =>
    [...document.querySelectorAll(".projects__dot")].findIndex((d) =>
      d.classList.contains("projects__dot--active"),
    ),
  );
  if (activeDot !== 1) problems.push(`подсвечена точка ${activeDot}, ожидалась 1`);

  // Смахивание. На узком экране это единственный жест листания, поэтому
  // проверяем настоящими событиями касания, а не перетаскиванием мышью:
  // они приходят с pointerType «touch» и ведут себя иначе.
  const swipe = async (dx, dy = 0) => {
    const card = await page.locator(".projects__featured").boundingBox();
    await page.evaluate(
      ([x, y, ex, ey]) => {
        const el = document.elementFromPoint(x, y);
        const opts = (cx, cy) => ({
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: cx,
          clientY: cy,
        });
        el.dispatchEvent(new PointerEvent("pointerdown", opts(x, y)));
        el.dispatchEvent(new PointerEvent("pointermove", opts((x + ex) / 2, (y + ey) / 2)));
        el.dispatchEvent(new PointerEvent("pointerup", opts(ex, ey)));
      },
      [
        card.x + card.width / 2 - dx / 2,
        card.y + card.height / 2 - dy / 2,
        card.x + card.width / 2 + dx / 2,
        card.y + card.height / 2 + dy / 2,
      ],
    );
    await page.waitForTimeout(350);
    return page.locator(".projects__badge").textContent();
  };

  const badge0 = await page.locator(".projects__badge").textContent();
  const afterLeft = await swipe(-160);
  if (afterLeft === badge0) problems.push("смахивание влево не листает");
  if (new URL(page.url()).pathname !== "/") problems.push("смахивание открыло страницу проекта");

  const afterRight = await swipe(160);
  if (afterRight !== badge0) problems.push("смахивание вправо не вернуло карточку");

  // Вертикальный жест — это обычная прокрутка, листать он не должен.
  const afterVertical = await swipe(20, 180);
  if (afterVertical !== badge0) problems.push("вертикальный жест переключил карточку");

  // Короткое движение — это нажатие, а не смахивание.
  const afterTap = await swipe(20);
  if (afterTap !== badge0) problems.push("случайное дрожание пальца листает карточки");

  // Центральная карточка ведёт на страницу проекта
  const href = await page.locator(".projects__featured").getAttribute("href");
  if (!href?.startsWith("/startups/")) problems.push(`центральная карточка ведёт на ${href}`);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  if (overflow) problems.push("страница прокручивается вбок");

  if (problems.length) bad++;
  console.log(
    `${problems.length ? "✗" : "✓"} ${win.n.padEnd(9)} ${win.note.padEnd(34)} ` +
      `карточка ${box.карточка}, блок ${box.блок}px, окно ${box.окно}px ${problems.join("; ")}`,
  );
  await ctx.close();
}

await browser.close();
console.log(bad === 0 ? "\nБлок «Наши проекты» работает на всех размерах." : `\nПроблем: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
