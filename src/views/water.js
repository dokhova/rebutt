// Жидкость за выбранный день: поправить стаканами (как на «+») или удалить запись.
import { WATER_STEPS } from '../domain/catalog.js';
import { dailyTargets } from '../domain/targets.js';
import { litres } from '../domain/suggestions.js';
import { dayMonth } from '../domain/dates.js';

const STEP_ML = 250;
const CUPS = 8;

export function waterView(app) {
  const w = app.state.waterEdit, goal = dailyTargets(app.state.profile).waterMl;
  return {
    waterWhen: dayMonth(w.day),
    weLitres: litres(w.ml),
    weMl: String(w.ml),
    weGoal: 'из ' + litres(goal) + ' л за день',
    weOf: '/ ' + litres(goal) + ' л',
    // стаканы по 250 мл: тап по стакану n — за день n × 250 мл
    weCups: Array.from({ length: CUPS }, (_, i) => ({
      cls: 'cup' + (i < Math.round(w.ml / STEP_ML) ? ' on' : ''),
      label: 'Стакан ' + (i + 1) + ' — ' + litres((i + 1) * STEP_ML) + ' л за день',
      tap: () => app.setWaterEditCups(i + 1)
    })),
    weBar: 'width: ' + Math.min(100, Math.round(w.ml / goal * 100)) + '%',
    weMinus: () => app.stepWaterEdit(-STEP_ML),
    weMinusCls: 'round-btn lg' + (w.ml > 0 ? '' : ' off'),
    wePlus: () => app.stepWaterEdit(STEP_ML),
    weSteps: WATER_STEPS.map(([ml, label]) => ({ label, ml: '+' + ml + ' мл', add: () => app.stepWaterEdit(ml) })),
    weOnInput: (e) => app.setWaterEditMl(e.target.value),
    saveWater: () => app.saveWaterEdit(),
    deleteWater: () => app.deleteWater(),
    closeWater: () => app.closeWater()
  };
}
