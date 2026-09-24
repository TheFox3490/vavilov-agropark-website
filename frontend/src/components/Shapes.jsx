import { useEffect, useMemo, useState } from "react";

import { SHAPES } from "../shapes";

/* Фоновый слой из 3D-объектов макета: кубы, торы и сферы.

   Цвет и размытие запечены в файлы (tools/bake_shapes.py), фильтров
   в браузере нет — слой одинаково лёгкий на любом устройстве.

   Расставлять объекты умеют два алгоритма, выбор — константой MODE ниже.

   "stable" — действующий. Объекты идут сверху вниз с постоянным шагом,
   и шаг зависит только от ширины экрана. Положение каждого объекта не
   зависит ни от высоты окна, ни от длины страницы, поэтому при прокрутке
   и подгрузке фон стоит на месте: страница удлинилась — снизу добавились
   новые объекты, уже стоящие не шелохнулись.

   "legacy" — прежний, оставлен для отката. Число объектов он считал как
   «длина страницы ÷ высота окна», а ставил их в процентах от длины
   страницы. Из-за этого фон перестраивался целиком:
     - на телефоне при каждой смене направления прокрутки — адресная строка
       прячется, высота окна меняется на 70–80px, и объекты перепрыгивали
       на расстояние до 440px;
     - при любом изменении длины страницы — подгрузились новости, пришли
       шрифты, — все объекты съезжали пропорционально;
     - при первой загрузке на медленной сети — 2–3 раза подряд.
   Замеры и проверка — tools/background-stability.mjs.

   Для сверки на настоящем телефоне режим можно переключить без пересборки:
   ?shapes=legacy или ?shapes=stable в адресе. Выбор запоминается до
   закрытия вкладки. */

const MODE = "stable"; // "stable" | "legacy"

const MODES = ["stable", "legacy"];

function resolveMode() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("shapes");
    if (MODES.includes(fromUrl)) {
      sessionStorage.setItem("shapes-mode", fromUrl);
      return fromUrl;
    }
    const saved = sessionStorage.getItem("shapes-mode");
    if (MODES.includes(saved)) return saved;
  } catch {
    // Хранилище может быть недоступно (приватный режим) — не страшно,
    // тогда действует значение из кода.
  }
  return MODE;
}

// Режим выбирается один раз при загрузке сайта: менять алгоритм на ходу,
// между переходами по страницам, незачем.
const ACTIVE_MODE = resolveMode();

/* Эталон плотности взят из макета: 16 видимых объектов на 2,68 экрана,
   то есть примерно 6 штук на экран. На узких экранах объекты крупнее
   относительно ширины, поэтому их нужно меньше. Общее для обоих режимов. */
const DENSITY_DESKTOP = 6;
const DENSITY_TABLET = 5;
const DENSITY_MOBILE = 4.5;

function densityFor(width) {
  if (width <= 600) return DENSITY_MOBILE;
  if (width <= 900) return DENSITY_TABLET;
  return DENSITY_DESKTOP;
}

/* Общая часть: какой объект встаёт на место с данным номером и куда
   по горизонтали. Номер определяет всё, кроме вертикали, — поэтому
   у одного и того же номера в обоих режимах тот же объект. */
function shapeAt(index) {
  const source = SHAPES[index % SHAPES.length];
  const cycle = Math.floor(index / SHAPES.length);
  return {
    key: `${index}-${source.file}`,
    file: source.file,
    size: source.size,
    // Каждый следующий проход по набору зеркалим, чтобы повтор не читался.
    x: cycle % 2 ? 100 - source.x : source.x,
  };
}

// Детерминированное дрожание по вертикали: без него объекты выстраиваются
// по линейке. Доля шага от −0,35 до +0,35.
function jitterAt(index) {
  return (((index * 37) % 100) / 100 - 0.5) * 0.7;
}

/* ------------------------------------------------------------------------ */
/*  Режим "legacy" — прежний алгоритм, без изменений                        */
/* ------------------------------------------------------------------------ */

function measureLegacy(prev) {
  const height = document.documentElement.scrollHeight;
  const viewport = window.innerHeight;
  const width = window.innerWidth;
  // Порог отсекает дребезг при подгрузке картинок и заодно страхует
  // от зацикливания, если пересчёт вдруг повлияет на высоту страницы.
  return Math.abs(prev.height - height) < 60 && prev.width === width && prev.viewport === viewport
    ? prev
    : { height, viewport, width };
}

function buildLegacy({ height, viewport, width }) {
  if (!height || !viewport) return [];

  const screens = height / viewport;
  const count = Math.min(64, Math.max(4, Math.round(screens * densityFor(width))));
  const step = 100 / count;

  return Array.from({ length: count }, (_, index) => ({
    ...shapeAt(index),
    y: `${Math.min(99, Math.max(1, step * (index + 0.5 + jitterAt(index))))}%`,
  }));
}

/* ------------------------------------------------------------------------ */
/*  Режим "stable" — действующий                                            */
/* ------------------------------------------------------------------------ */

/* Высота экрана в долях ширины — типичная для каждого класса устройств.
   Высоту настоящего окна брать нельзя: на телефоне она меняется при каждой
   прокрутке вместе с адресной строкой, в этом и была беда прежнего режима.
   Числа подобраны так, чтобы плотность совпадала с прежней: телефон 390×745,
   планшет 768×960, окно браузера на мониторе 1920×1000. */
const SCREEN_ASPECT_MOBILE = 1.9;
const SCREEN_ASPECT_TABLET = 1.25;
const SCREEN_ASPECT_DESKTOP = 0.52;

// Потолок числа объектов — чтобы очень длинная лента новостей не набирала
// сотни картинок. Этого хватает примерно на 15 экранов.
const STABLE_MAX = 120;

/* Ширину берём у корня документа, а не у окна: на айфоне window.innerWidth
   меняется при масштабировании щипком, а ширина документа — нет. Зато на ПК
   ширина документа меняется на ширину полосы прокрутки, когда та появляется
   (короткая страница догрузилась и стала длинной). Перестраивать из-за этого
   фон незачем, поэтому мелкие колебания ширины пропускаем. */
const WIDTH_TOLERANCE = 32;

function stepFor(width) {
  if (width <= 600) return (width * SCREEN_ASPECT_MOBILE) / DENSITY_MOBILE;
  if (width <= 900) return (width * SCREEN_ASPECT_TABLET) / DENSITY_TABLET;
  return (width * SCREEN_ASPECT_DESKTOP) / DENSITY_DESKTOP;
}

function measureStable(prev) {
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.scrollHeight;
  const sameWidth = Math.abs(prev.width - width) < WIDTH_TOLERANCE;
  if (sameWidth && prev.height === height) return prev;
  // Длину страницы обновляем всегда, но от неё зависит только число
  // объектов: сдвинуть уже стоящие она не может.
  return { width: sameWidth ? prev.width : width, height };
}

function buildStable({ height, width }) {
  if (!height || !width) return [];

  const step = stepFor(width);
  const count = Math.min(STABLE_MAX, Math.max(1, Math.round(height / step)));

  // Вертикаль — в пикселях от верха страницы, и зависит она только от номера
  // и шага. Длина страницы определяет лишь, сколько номеров поместилось.
  return Array.from({ length: count }, (_, index) => ({
    ...shapeAt(index),
    y: `${Math.round(step * (index + 0.5 + jitterAt(index)))}px`,
  }));
}

/* ------------------------------------------------------------------------ */

export default function Shapes() {
  const [metrics, setMetrics] = useState({ height: 0, viewport: 0, width: 0 });

  useEffect(() => {
    const measure = () =>
      setMetrics((prev) => (ACTIVE_MODE === "legacy" ? measureLegacy(prev) : measureStable(prev)));

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const items = useMemo(
    () => (ACTIVE_MODE === "legacy" ? buildLegacy(metrics) : buildStable(metrics)),
    [metrics],
  );

  return (
    <div className="shapes" aria-hidden="true" data-mode={ACTIVE_MODE}>
      {items.map((shape) => (
        <img
          key={shape.key}
          className="shape"
          src={shape.file}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ "--s": shape.size, "--x": `${shape.x}%`, "--y": shape.y }}
        />
      ))}
    </div>
  );
}
