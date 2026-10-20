// Жидкость за выбранный день: поправить количество или удалить запись.
import { WATER_STEPS } from '../domain/catalog.js';
import { dailyTargets } from '../domain/targets.js';
import { litres } from '../domain/suggestions.js';
import { dayMonth } from '../domain/dates.js';

const STEP_ML = 250;

export function waterView(app) {
  const w = app.state.waterEdit, goal = dailyTargets(app.state.profile).waterMl;
  return {
    waterWhen: dayMonth(w.day),
    weLitres: litres(w.ml),
    weMl: String(w.ml),
    weGoal: 'из ' + litres(goal) + ' л за день',
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
