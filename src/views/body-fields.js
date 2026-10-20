// Рост и вес — одни и те же поля в онбординге («О себе») и в профиле.
import { HEIGHT_MIN, HEIGHT_MAX, WEIGHT_MIN, WEIGHT_MAX } from '../domain/catalog.js';
import { validHeight, validWeight } from '../domain/profile.js';
import { dailyTargets } from '../domain/targets.js';
import { litres } from '../domain/suggestions.js';

export function bodyFieldsView(app) {
  const p = app.state.profile, t = dailyTargets(p);
  const badHeight = p.height != null && validHeight(p.height) == null;
  const badWeight = p.weight != null && validWeight(p.weight) == null;
  return {
    body: {
      height: p.height == null ? '' : String(p.height),
      weight: p.weight == null ? '' : String(p.weight),
      setHeight: (e) => app.setHeight(e.target.value),
      setWeight: (e) => app.setWeight(e.target.value),
      heightCls: 'field-input body-input' + (badHeight ? ' invalid' : ''),
      weightCls: 'field-input body-input' + (badWeight ? ' invalid' : ''),
      error: badHeight ? 'Рост — от ' + HEIGHT_MIN + ' до ' + HEIGHT_MAX + ' см' : badWeight ? 'Вес — от ' + WEIGHT_MIN + ' до ' + WEIGHT_MAX + ' кг' : '',
      // ориентир на день — сразу видно, зачем мы спрашиваем
      targets: 'Ориентир на день: вода ' + litres(t.waterMl) + ' л, клетчатка ' + t.fiberG + ' г'
    }
  };
}
