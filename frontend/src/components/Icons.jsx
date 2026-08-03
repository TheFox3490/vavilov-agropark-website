/* Иконки из макета (в Figma подключены через Iconify: mingcute, akar-icons,
   material-symbols, file-icons) перерисованы инлайновыми SVG — так они
   наследуют цвет текста и не тянут внешних зависимостей. */

const base = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
  focusable: false,
};

export function PhoneIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02z" />
    </svg>
  );
}

export function TelegramIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M21.94 4.66a1.2 1.2 0 0 0-1.6-1.16L2.7 10.36c-1.05.41-1.03 1.9.03 2.28l4.4 1.56 1.7 5.16c.26.78 1.25 1 1.82.42l2.45-2.5 4.34 3.2c.7.5 1.7.13 1.87-.72zM8.9 13.63l8.53-5.25-6.6 6.06a1.2 1.2 0 0 0-.37.7l-.3 2.06z" />
    </svg>
  );
}

export function MailIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2a10 10 0 1 0 4.5 18.93a1 1 0 1 0-.9-1.79A8 8 0 1 1 20 12v1a1.5 1.5 0 0 1-3 0V8a1 1 0 1 0-2 0v.28A4.5 4.5 0 1 0 15.6 15A3.5 3.5 0 0 0 22 13v-1A10 10 0 0 0 12 2m0 12.5a2.5 2.5 0 1 1 0-5a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

export function VkIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12.79 17.5c-5.36 0-8.6-3.72-8.73-9.9h2.7c.09 4.54 2.14 6.47 3.7 6.86V7.6h2.56v3.86c1.51-.16 3.09-1.9 3.62-3.86h2.52a7.24 7.24 0 0 1-3.32 4.72a7.5 7.5 0 0 1 3.89 4.68h-2.78c-.6-1.88-2.05-3.33-3.93-3.52v3.52z" />
    </svg>
  );
}

export function ArrowRightIcon(props) {
  return (
    <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 12h15m0 0l-5.5-5.5M19 12l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronIcon(props) {
  return (
    <svg {...base} fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m6 9l6 6l6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg {...base} fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function UserIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20m0 5a3.2 3.2 0 1 1 0 6.4A3.2 3.2 0 0 1 12 7m0 13a7.96 7.96 0 0 1-5.4-2.1c.35-1.9 3.1-2.9 5.4-2.9s5.05 1 5.4 2.9A7.96 7.96 0 0 1 12 20" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg {...base} fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

/* Логотип «АГРОПАРК» — шестиугольник из точек, как в макете. */
export function LogoMark(props) {
  const nodes = [
    [24, 6],
    [39.6, 15],
    [39.6, 33],
    [24, 42],
    [8.4, 33],
    [8.4, 15],
  ];
  return (
    <svg viewBox="0 0 48 48" width="1em" height="1em" aria-hidden focusable="false" {...props}>
      <polygon
        points={nodes.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.85"
      />
      {nodes.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.4" fill="currentColor" />
      ))}
      <circle cx="24" cy="24" r="4.2" fill="currentColor" />
    </svg>
  );
}
