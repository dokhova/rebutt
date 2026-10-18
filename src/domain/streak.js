// Стрик — сколько дней подряд есть записи. Сегодня без записей стрик не обнуляет (день ещё не закончился).
import { addDays } from './dates.js';
import { hasData } from './score.js';

export function streakDays(log, todayK) {
  let k = hasData(log[todayK]) ? todayK : addDays(todayK, -1);
  let n = 0;
  while (hasData(log[k])) { n++; k = addDays(k, -1); }
  return n;
}
