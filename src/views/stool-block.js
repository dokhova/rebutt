// Блок «Стул» — один для новой записи («+») и для правки записи из «Записей дня»:
// был / не было, карусель типов (свайп пальцем, стрелки, тап по соседнему), самочувствие, стресс тремя кнопками.
// target: 'form' — «+», 'edit' — правка записи. Шаблоны — partials/add-carousel.html, screens/add.html, screens/entry.html.
import { BRISTOL_TYPES, SYMPTOMS } from '../domain/catalog.js';

const STEP_PX = 104;      // шаг карусели: ширина карточки 80 + промежуток 24 (как в CSS .cinner)
const DRAG_START_PX = 8;  // меньше — это тап, а не свайп
const CLICK_AFTER_DRAG_MS = 300;

let drag = null;          // палец на карусели: { x, id, moved }
let dragEndedAt = 0;      // чтобы отпущенный свайп не считался тапом по карточке

export const STRESS_BUTTONS = [['low', 'Низкий', 2], ['mid', 'Средний', 5], ['high', 'Высокий', 8]];

export function stoolBlockView(app, target) {
  const d = app.gutDraft(target);
  const had = d.stool === 'had', sel = had ? d.type : 4;
  const typeName = (n) => BRISTOL_TYPES[n].replace(' — норма', '');

  return {
    stoolHadCls: 'gseg' + (d.stool === 'had' ? ' on' : ''),
    stoolNoneCls: 'gseg' + (d.stool === 'none' ? ' on' : ''),
    setStoolHad: () => app.setStool('had', target),
    setStoolNone: () => app.setStool('none', target),
    showCarousel: d.stool !== 'none',

    // карусель: все 7 типов в ленте, лента едет к выбранному (--i), палец тянет её вживую (--drag) без перерисовки
    cindex: 'transform: translate(calc(-40px - ' + (sel - 1) + ' * ' + STEP_PX + 'px + var(--drag, 0px)), -50%)',
    ctypes: [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      type: String(n),
      cls: 'ctype' + (n === sel ? ' center' : '') + (had && n === sel ? ' on' : ''),
      aria: 'Тип ' + n + ', ' + typeName(n),
      pick: () => { if (Date.now() - dragEndedAt > CLICK_AFTER_DRAG_MS) app.pickBristolType(n, target); }
    })),
    ctypeName: had ? typeName(sel) : 'Листайте и выберите похожий',
    ctypeNum: had ? 'Тип ' + sel : '',
    cdots: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ cls: 'cdot' + (had && n === sel ? ' on' : '') })),
    cprev: () => app.stepBristolType(-1, target),
    cnext: () => app.stepBristolType(1, target),
    cdrag: (e) => {
      const track = e.target.closest && e.target.closest('.ctrack');
      if (!track) return;
      if (e.type === 'pointerdown') { drag = { x: e.clientX, id: e.pointerId, moved: false }; return; }
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (e.type === 'pointermove') {
        if (!drag.moved && Math.abs(dx) < DRAG_START_PX) return;
        if (!drag.moved) {
          drag.moved = true;
          track.classList.add('dragging');
          try { track.setPointerCapture(drag.id); } catch (_) { /* палец уже ушёл */ }
        }
        track.style.setProperty('--drag', dx + 'px');
        return;
      }
      // отпустили: доезжаем до ближайшего типа плавно (transition в CSS)
      track.classList.remove('dragging');
      track.style.removeProperty('--drag');
      const moved = drag.moved;
      drag = null;
      if (!moved) return;
      dragEndedAt = Date.now();
      const steps = Math.round(-dx / STEP_PX);
      if (steps) app.stepBristolType(steps, target);
      else if (!had) app.pickBristolType(sel, target);
    },

    symptomChips: SYMPTOMS.map((label) => {
      const on = d.sym.includes(label);
      return { label, on, cls: 'gchip' + (on ? ' on' : ''), pick: () => app.toggleSymptom(label, target) };
    }),
    stressLevels: STRESS_BUTTONS.map(([id, label, v]) => ({
      label, on: d.stress === v, cls: 'gseg' + (d.stress === v ? ' on' : ''), pick: () => app.setStressLevel(id, target)
    }))
  };
}
