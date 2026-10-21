// Модалка «На главный экран»: когда показывать снова.
// record — что человек ответил в прошлый раз: { state: 'added' | 'later' | 'close', at: ms } или null.

/** Через сколько дней спросить снова: «Напомнить позже» — 3, крестик или «Назад» — 14 */
export const HOME_PROMPT_SNOOZE_DAYS = { later: 3, close: 14 };

export function homePromptSnoozed(record, now = Date.now()) {
  if (!record || typeof record !== 'object') return false;
  if (record.state === 'added') return true;
  const days = HOME_PROMPT_SNOOZE_DAYS[record.state];
  return !!days && typeof record.at === 'number' && now - record.at < days * 864e5;
}
