import { useState } from "react";

/* Часть изображений из макета ещё не выгружена (Figma отдаёт их крайне медленно).
   Пока файла нет, показываем аккуратную заглушку в цветах макета вместо
   сломанной иконки картинки. Как только файл появится в /public/media —
   заглушка исчезает сама, править код не нужно. */
export default function Picture({ src, alt = "", className = "", label, ...rest }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`picture-stub ${className}`} role="img" aria-label={alt}>
        {label && <span>{label}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
