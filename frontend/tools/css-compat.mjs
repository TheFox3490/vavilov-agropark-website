/* Проверяет СОБРАННЫЙ CSS на запись, которую не понимают браузеры постарше.

   Зачем отдельная проверка. Смотреть исходники бесполезно: там всё написано
   совместимо. Портит запись минификатор на сборке. Так уже случилось: без
   заданной цели сборки Vite счёл браузеры свежими и переписал
   `@media (max-width: 700px)` в `@media (width <= 700px)`. Safari понимает
   диапазоны только с 16.4 — на iOS 16.0–16.3 все медиазапросы разом стали
   недействительны, и на телефоне открывалась десктопная раскладка.

   Ни один прогон в браузере этого бы не поймал: эмуляция устройств в Chrome
   меняет размер экрана и user-agent, но движок остаётся Chrome. И «проверил
   Яндексом на айфоне» тоже не поймал бы: на iOS все браузеры обязаны работать
   на движке Safari.

   Запуск (после vite build):  node tools/css-compat.mjs
*/

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = process.argv[2] ?? "dist/assets";

/* Нижняя граница поддержки — Safari 15.4. Ниже опускаться незачем: сайт уже
   пользуется dvh и aspect-ratio, они появились там же. Всё, что новее этой
   границы, в собранном файле оказаться не должно. */
const FORBIDDEN = [
  {
    // Главный виновник. Ищем `(width<=`, `(width>=`, `(400px<width` и т.п.
    re: /@media[^{]*\((?:min-|max-)?(?:width|height|aspect-ratio)\s*[<>]=?|@media[^{]*[\d.]+(?:px|rem|em)\s*[<>]=?\s*(?:width|height)/gi,
    what: "диапазонная запись медиазапроса",
    since: "Safari 16.4",
    fix: "задать build.cssTarget в vite.config.js",
  },
  { re: /:has\(/gi, what: "селектор :has()", since: "Safari 15.4", fix: "переписать через класс на родителе" },
  { re: /@container/gi, what: "контейнерные запросы", since: "Safari 16", fix: "заменить обычным медиазапросом" },
  { re: /@property/gi, what: "@property", since: "Safari 16.4", fix: "убрать типизацию переменной" },
  { re: /\boklch\(|\boklab\(|\bcolor-mix\(|\blight-dark\(/gi, what: "новая запись цвета", since: "Safari 16.4+", fix: "задать build.cssTarget" },
  { re: /text-wrap\s*:\s*(balance|pretty)/gi, what: "text-wrap: balance/pretty", since: "Safari 17.5", fix: "убрать — это украшение" },
  { re: /\bsubgrid\b/gi, what: "subgrid", since: "Safari 16", fix: "развернуть в обычный грид" },
  // Вложенность минификатор обычно раскрывает, но если протечёт — заметим.
  { re: /\{[^{}]*[;{]\s*&[\s.:#[]/g, what: "вложенность CSS", since: "Safari 16.5", fix: "задать build.cssTarget" },
];

let files;
try {
  files = readdirSync(DIR).filter((f) => f.endsWith(".css"));
} catch {
  console.error(`Папки ${DIR} нет. Сначала собери фронтенд:  npx vite build`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`В ${DIR} нет ни одного .css — сборка не удалась?`);
  process.exit(1);
}

console.log(`Проверяю собранный CSS в ${DIR} на совместимость с Safari 15.4+\n`);

let failures = 0;

for (const file of files) {
  const css = readFileSync(join(DIR, file), "utf8");
  console.log(`  ${file} (${(css.length / 1024).toFixed(1)} КБ)`);

  for (const rule of FORBIDDEN) {
    const hits = css.match(rule.re);
    if (!hits) continue;
    failures++;
    const sample = [...new Set(hits)].slice(0, 4).join("  ");
    console.log(`    ✗ ${rule.what} — ${hits.length} шт., работает только с ${rule.since}`);
    console.log(`      например: ${sample}`);
    console.log(`      как чинить: ${rule.fix}`);
  }

  // Отдельно убеждаемся, что привычная запись на месте: если медиазапросов
  // не осталось совсем, значит их переписали во что-то, чего мы не ждали.
  const classic = (css.match(/@media[^{]*\((?:min|max)-(?:width|height):/gi) ?? []).length;
  if (classic === 0 && css.includes("@media")) {
    failures++;
    console.log("    ✗ ни одного медиазапроса в привычной записи (min-/max-width)");
  } else if (classic > 0) {
    console.log(`    ✓ медиазапросов в совместимой записи: ${classic}`);
  }
}

console.log(
  failures === 0
    ? "\nГотово: несовместимой записи нет."
    : `\nНайдено проблем: ${failures}. На старых iPhone вёрстка развалится.`,
);
process.exit(failures === 0 ? 0 : 1);
