// Правка сохранённой записи о стуле / самочувствии: тот же блок, что на «+» (views/stool-block.js), плюс удаление.
import { dayMonth } from '../domain/dates.js';
import { stoolBlockView } from './stool-block.js';

export function entryView(app) {
  const e = app.state.entryEdit;
  return {
    entryWhen: dayMonth(e.day) + ', ' + e.time,
    ...stoolBlockView(app, 'edit'),
    saveEntry: () => app.saveEntryEdit(),
    deleteEntry: () => app.deleteEntry(),
    closeEntry: () => app.closeEntry()
  };
}
