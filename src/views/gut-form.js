// Форма «стул, цвет, самочувствие, стресс» — одна для новой записи и для правки сохранённой.
// target: 'form' — экран «+», 'edit' — правка записи. Шаблон — src/templates/partials/gut-form.html (значения в gf).
import { BRISTOL_TYPES, SYMPTOMS, STOOL_COLORS, STOOL_COLOR_NOTES, stressWord } from '../domain/catalog.js';

export function gutFormView(app, target) {
  const d = app.gutDraft(target);
  const seg = (on) => 'seg' + (on ? ' on' : '');
  const stressSet = d.stress != null;
  return {
    gf: {
      stoolHad: seg(d.stool === 'had'),
      stoolNone: seg(d.stool === 'none'),
      setHad: () => app.setStool('had', target),
      setNone: () => app.setStool('none', target),
      // тип и цвет показываем сразу, пока не выбрано «Не было»
      showTypes: d.stool !== 'none',
      types: Object.keys(BRISTOL_TYPES).map(Number).map((n) => ({
        type: String(n), short: BRISTOL_TYPES[n], on: d.stool === 'had' && d.type === n,
        aria: 'Тип ' + n + ', ' + BRISTOL_TYPES[n],
        cls: 'type-card' + (d.stool === 'had' && d.type === n ? ' on' : ''),
        pick: () => app.pickBristolType(n, target)
      })),
      colors: STOOL_COLORS.map((c) => ({
        label: c.label, hex: c.hex, on: d.color === c.id,
        cls: 'chip color-chip' + (d.color === c.id ? ' on' : ''),
        pick: () => app.pickStoolColor(c.id, target)
      })),
      colorNote: STOOL_COLOR_NOTES[d.color] || '',
      symptoms: SYMPTOMS.map((label) => {
        const on = d.sym.includes(label);
        return { label, on, cls: 'chip' + (on ? ' on' : ''), pick: () => app.toggleSymptom(label, target) };
      }),
      stress: stressSet ? d.stress : 0,
      stressLabel: stressSet ? d.stress + ' · ' + stressWord(d.stress) : 'не отмечено',
      stressCls: 'slider' + (stressSet ? '' : ' unset'),
      onStress: (e) => app.setStress(e.target.value, target)
    }
  };
}
