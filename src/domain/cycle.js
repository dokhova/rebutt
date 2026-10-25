// Менструальный цикл: день цикла и фаза. Учитывается только если включён в профиле.
import { diffDays } from './dates.js';

/**
 * День цикла (1…len) для дня `dayK`. 0 — цикл не учитывается или дата начала неизвестна.
 * profile.lastAgo — сколько дней назад от сегодня начались последние месячные.
 */
export function cycleDay(profile, dayK, todayK) {
  if (!profile.cycle || profile.lastUnknown || profile.pregnant || profile.menopause) return 0;
  const sinceStart = diffDays(dayK, todayK) + profile.lastAgo;
  const len = profile.len;
  return ((sinceStart % len) + len) % len + 1;
}

/** День считается днём месячных: первые 5 дней цикла или отмечено вручную */
export const isPeriodDay = (profile, day, cd) => profile.cycle && ((cd >= 1 && cd <= 5) || !!day.period);

export const MENOPAUSE_NOTE = ['Менопауза', 'Когда эстрогена становится меньше, кишечник у многих работает медленнее — вздутие и запоры в этот период бывают чаще. Помогают вода, клетчатка и движение. Если что-то беспокоит — это стоит обсудить с врачом.'];

export const PREGNANCY_NOTE = ['Беременность', 'Прогестерон немного замедляет кишечник, поэтому вздутие и более редкий стул — частая история. Помогают вода, клетчатка и прогулки. Добавки и любые средства лучше обсудить с врачом, который ведёт беременность.'];

/** Фаза цикла: [название, как это влияет на кишечник]. На КОК фазы сглажены — две «фазы». */
export function cyclePhase(d, len, coc = false) {
  if (coc) {
    if (d <= 5) return ['Кровотечение отмены', 'Стул может быть мягче, как во время обычных месячных.'];
    return ['Приём таблеток', 'На КОК гормоны ровные, резких фазовых перемен нет. Если после начала приёма кишечник ведёт себя иначе — отмечайте, это удобно обсудить с врачом.'];
  }
  if (d <= 5) return ['Месячные', 'Стул может быть мягче и чаще — это частая история, так действуют простагландины.'];
  if (d <= len - 16) return ['После месячных', 'Обычно самый ровный период для кишечника.'];
  if (d <= len - 12) return ['Овуляция', 'У некоторых бывает лёгкое вздутие на 1–2 дня.'];
  return ['Перед месячными', 'Прогестерон немного замедляет кишечник — вздутие и более редкий стул в эти дни частые и нормальные. Помогут вода и клетчатка.'];
}

/** Через сколько дней по расчёту начнутся следующие месячные (1 — завтра) */
export const daysToPeriod = (cd, len) => len - cd + 1;

/** За сколько дней до месячных предупреждаем */
export const PERIOD_WARN_DAYS = 3;

/**
 * Предупреждение о цикле на главной — только в важные дни, а не постоянно:
 * месячные (по расчёту или отмечены), овуляция, за PERIOD_WARN_DAYS дня до месячных.
 * На КОК — только дни кровотечения отмены. null — сегодня показывать нечего.
 * @returns {{ kind: 'period'|'soon'|'ovulation', phase: string, note: string } | null}
 */
export function cycleAlert(profile, day, cd) {
  if (!cd) return null;
  const len = profile.len;
  if (isPeriodDay(profile, day, cd)) {
    const [phase, note] = cyclePhase(cd <= 5 ? cd : 1, len, profile.coc);
    return { kind: 'period', phase: day.period ? phase : phase + ' по расчёту', note };
  }
  if (profile.coc) return null;
  const left = daysToPeriod(cd, len);
  if (left <= PERIOD_WARN_DAYS) {
    return { kind: 'soon', phase: left === 1 ? 'Месячные, скорее всего, завтра' : 'Месячные примерно через ' + left + ' дн.', note: cyclePhase(cd, len)[1] };
  }
  const [phase, note] = cyclePhase(cd, len);
  if (phase === 'Овуляция') return { kind: 'ovulation', phase: 'Овуляция примерно сейчас', note };
  return null;
}

/** Показывать ли в «+» отметку месячных целиком: за пару дней до, во время и сразу после; иначе — короткая ссылка */
export const periodMarkExpected = (profile, cd) =>
  cd > 0 && (cd <= 7 || daysToPeriod(cd, profile.len) <= PERIOD_WARN_DAYS);

/** Сколько дней до фазы «перед месячными» (минимум 1) */
export const daysToLuteal = (cd, len) => Math.max(1, (len - 11) - cd);
