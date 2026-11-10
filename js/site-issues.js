// Справочник проблем сайта, которые находит автоматическая проверка качества
// (scripts/site-quality.mjs). Общий модуль: подписи нужны и скрипту обновления, и интерфейсу.

export const ISSUES = {
  no_https:     { label: 'Нет HTTPS' },                       // страница открывается по http:
  no_viewport:  { label: 'Нет мобильной версии' },            // нет <meta name="viewport">
  no_title:     { label: 'Нет заголовка страницы' },          // нет или пустой <title>
  old_markup:   { label: 'Устаревшая вёрстка' },              // минимум два признака старой вёрстки
  parked:       { label: 'Домен продаётся или припаркован' }, // фразы парковки в видимом тексте
  builder_stub: { label: 'Сайт-заглушка' },                   // видимого текста меньше 200 символов
};

/** Известные id проблем из произвольного значения (в порядке справочника). */
export function knownIssues(value) {
  if (!Array.isArray(value)) return [];
  return Object.keys(ISSUES).filter((id) => value.includes(id));
}

/** Подписи проблем через запятую — для CSV и всплывающих подсказок. */
export function issueLabels(value) {
  return knownIssues(value).map((id) => ISSUES[id].label);
}
