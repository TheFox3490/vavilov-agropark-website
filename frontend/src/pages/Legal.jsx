import Hero from "../components/Hero";
import { useSettings, useSettingsLoading } from "../context/SettingsContext";
import usePageTitle from "../usePageTitle";
import NotFound from "./NotFound";
import "./cards.css";

/* Политика конфиденциальности и согласие на обработку данных.

   ОТСТУПЛЕНИЕ ОТ МАКЕТА: ссылки на оба документа есть в подвале каждого
   экрана, но самих текстов дизайнер не приводила. Тексты лежат в настройках
   и правятся из админки — юридические формулировки утверждает университет,
   и лазить за ними в код неправильно. */

/* Очень простая разметка: строка «## Заголовок» начинает раздел, пустая
   строка разделяет абзацы. Разбираем сами и рисуем обычными элементами —
   вставить через такой текст чужую разметку нельзя. */
function parse(text) {
  const blocks = [];
  for (const chunk of (text || "").split(/\n\s*\n/)) {
    const value = chunk.trim();
    if (!value) continue;
    if (value.startsWith("## ")) blocks.push({ kind: "heading", text: value.slice(3).trim() });
    else blocks.push({ kind: "text", text: value });
  }
  return blocks;
}

export default function Legal({ kind }) {
  const settings = useSettings();
  const title = settings[`legal_${kind}_title`];
  const blocks = parse(settings[`legal_${kind}_body`]);
  const draft = settings.legal_draft_notice === "on";
  const loading = useSettingsLoading();
  usePageTitle(title);

  /* Документы спрятаны галочкой в админке — для посетителя их нет.
     Ждём ответа сервера, прежде чем решать: иначе открытая ссылка
     на действующий документ на миг показывала бы «не найдено». */
  if (!loading && settings.legal_docs_enabled !== "on") return <NotFound />;

  return (
    <>
      <Hero compact />

      <section className="section">
        <div className="container">
          <article className="glass card-list legal">
            <h2 className="card-list__title">{title}</h2>

            {blocks.length === 0 && (
              <p className="legal__intro">
                Текст документа пока не заполнен. Его добавляют в админке, вкладка «Сайт».
              </p>
            )}

            {blocks.map((block, index) =>
              block.kind === "heading" ? (
                <h3 key={index} className="legal__heading">
                  {block.text}
                </h3>
              ) : (
                <p key={index} className={index === 0 ? "legal__intro" : "legal__text"}>
                  {block.text}
                </p>
              ),
            )}

            {draft && (
              <p className="legal__note">
                Документ носит предварительный характер: точные формулировки должен утвердить
                университет.
              </p>
            )}
          </article>
        </div>
      </section>
    </>
  );
}
