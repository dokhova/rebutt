// Менструальный цикл: день цикла и фаза. Учитывается только если включён в профиле.
import { diffDays } from './dates.js';

/**
 * День цикла (1…len) для дня `dayK`. 0 — цикл не учитывается или дата начала неизвестна.
 * profile.lastAgo — сколько дней назад от сегодня начались последние месячные.
 */
export function cycleDay(profile, dayK, todayK) {
  if (!profile.cycle || profile.lastUnknown) return 0;
  const sinceStart = diffDays(dayK, todayK) + profile.lastAgo;
  const len = profile.len;
  return ((sinceStart % len) + len) % len + 1;
}

/** День считается днём месячных: первые 5 дней цикла или отмечено вручную */
export const isPeriodDay = (profile, day, cd) => profile.cycle && ((cd >= 1 && cd <= 5) || !!day.period);

/** Фаза цикла: [название, как это влияет на кишечник] */
export function cyclePhase(d, len) {
  if (d <= 5) return ['Месячные', 'Стул может быть мягче и чаще — это нормально, так действуют простагландины. Тёплая еда и вода помогут.'];
  if (d <= len - 16) return ['После месячных', 'Обычно самый ровный период для кишечника. Хорошее время пробовать новые продукты.'];
  if (d <= len - 12) return ['Овуляция', 'Возможно лёгкое вздутие на 1–2 дня. Меньше газировки и бобовых.'];
  return ['Перед месячными', 'Прогестерон замедляет кишечник — вздутие и запоры ожидаемы. Больше воды и клетчатки.'];
}

/** Сколько дней до фазы «перед месячными» (минимум 1) */
export const daysToLuteal = (cd, len) => Math.max(1, (len - 11) - cd);
