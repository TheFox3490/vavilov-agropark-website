import { useEffect, useMemo, useState } from "react";

import { SHAPES } from "../shapes";

/* Фоновый слой из 3D-объектов макета: кубы, торы и сферы.

   Количество объектов считается от длины страницы, а не задано списком.
   Раньше на любой странице выводился один и тот же набор, и плотность
   гуляла вчетверо: на короткой странице («Новости», «Контакты») объекты
   наслаивались, на длинной («Проекты» на телефоне) терялись в пустоте.

   Эталон плотности взят из макета: 16 видимых объектов на 2,68 экрана,
   то есть примерно 6 штук на экран. На узких экранах объекты крупнее
   относительно ширины, поэтому их нужно меньше.

   Цвет и размытие запечены в файлы (tools/bake_shapes.py), фильтров
   в браузере нет — слой одинаково лёгкий на любом устройстве. */

const DENSITY_DESKTOP = 6;
const DENSITY_TABLET = 5;
const DENSITY_MOBILE = 4.5;

function densityFor(width) {
  if (width <= 600) return DENSITY_MOBILE;
  if (width <= 900) return DENSITY_TABLET;
  return DENSITY_DESKTOP;
}

function buildShapes({ height, viewport, width }) {
  if (!height || !viewport) return [];

  const screens = height / viewport;
  const count = Math.min(64, Math.max(4, Math.round(screens * densityFor(width))));
  const step = 100 / count;

  return Array.from({ length: count }, (_, index) => {
    const source = SHAPES[index % SHAPES.length];
    const cycle = Math.floor(index / SHAPES.length);
    // Детерминированное дрожание: без него объекты выстраиваются по линейке.
    const jitter = (((index * 37) % 100) / 100 - 0.5) * step * 0.7;
    return {
      key: `${index}-${source.file}`,
      file: source.file,
      size: source.size,
      // Каждый следующий проход по набору зеркалим, чтобы повтор не читался.
      x: cycle % 2 ? 100 - source.x : source.x,
      y: Math.min(99, Math.max(1, step * (index + 0.5) + jitter)),
    };
  });
}

export default function Shapes() {
  const [metrics, setMetrics] = useState({ height: 0, viewport: 0, width: 0 });

  useEffect(() => {
    const measure = () => {
      const height = document.documentElement.scrollHeight;
      const viewport = window.innerHeight;
      const width = window.innerWidth;
      setMetrics((prev) =>
        // Порог отсекает дребезг при подгрузке картинок и заодно страхует
        // от зацикливания, если пересчёт вдруг повлияет на высоту страницы.
        Math.abs(prev.height - height) < 60 && prev.width === width && prev.viewport === viewport
          ? prev
          : { height, viewport, width },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const items = useMemo(() => buildShapes(metrics), [metrics]);

  return (
    <div className="shapes" aria-hidden="true">
      {items.map((shape) => (
        <img
          key={shape.key}
          className="shape"
          src={shape.file}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ "--s": shape.size, "--x": `${shape.x}%`, "--y": `${shape.y}%` }}
        />
      ))}
    </div>
  );
}
