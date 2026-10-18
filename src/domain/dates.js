// Даты в приложении хранятся как ключи дня 'YYYY-MM-DD' в локальном времени пользователя.

export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const pad = (n) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD' */
export const keyOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

/** 'YYYY-MM-DD' → Date (полночь, локальное время) */
export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (k, n) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};

/** Разница a − b в днях */
export const diffDays = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 864e5);

/** Понедельник недели, в которую входит день */
export const mondayOf = (k) => {
  const d = parseKey(k);
  return addDays(k, -((d.getDay() + 6) % 7));
};

/** Текущее время 'HH:MM' */
export const nowHM = () => {
  const d = new Date();
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
};

/** '18 октября' */
export const dayMonth = (k) => {
  const d = parseKey(k);
  return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()];
};

/** '18 окт' */
export const dayMonthShort = (k) => {
  const d = parseKey(k);
  return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()].slice(0, 3);
};

/** 1 год, 2 года, 5 лет */
export const yearsWord = (n) =>
  n % 10 === 1 && n % 100 !== 11 ? 'год'
    : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'года'
      : 'лет';
