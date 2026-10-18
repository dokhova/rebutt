// Правка сохранённой записи о стуле / самочувствии: та же форма, что на «+», плюс удаление.
import { dayMonth } from '../domain/dates.js';
import { gutFormView } from './gut-form.js';

export function entryView(app) {
  const e = app.state.entryEdit;
  return {
    entryWhen: dayMonth(e.day) + ', ' + e.time,
    ...gutFormView(app, 'edit'),
    saveEntry: () => app.saveEntryEdit(),
    deleteEntry: () => app.deleteEntry(),
    closeEntry: () => app.closeEntry()
  };
}
