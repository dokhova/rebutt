// Выгрузка данных пользователя: CSV и отчёт для врача (страница печати → «Сохранить как PDF»).
import { BRISTOL_TYPES, SYMPTOM_OK } from '../domain/catalog.js';
import { gutScore, emptyDay } from '../domain/score.js';

const REPORT_DAYS = 30;

const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const typeName = (t) => BRISTOL_TYPES[t].replace(' — норма', '');

function download(filename, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Плоский список записей: по одной строке на стул/самочувствие, еду и день месячных */
function flatten(log) {
  const rows = [];
  for (const k of Object.keys(log).sort()) {
    const r = log[k];
    for (const g of r.gut || []) {
      const what = g.type > 0 ? 'Тип ' + g.type + ' — ' + typeName(g.type) : g.type === 0 ? 'Стула не было' : 'Самочувствие';
      rows.push([k, g.time, 'Стул', what, (g.sym || []).join(', ')]);
    }
    for (const m of r.meals || []) rows.push([k, m.time, 'Еда', m.name, m.kcal + ' ккал, Б ' + (m.protein || 0) + ' г, Ж ' + (m.fat || 0) + ' г, У ' + (m.carbs || 0) + ' г, клетчатка ' + m.fiber + ' г']);
    if (r.period) rows.push([k, '', 'Цикл', 'Месячные', '']);
  }
  return rows;
}

/** Скачивает CSV (разделитель «;», UTF-8 с BOM — корректно открывается в Excel). Возвращает число строк. */
export function exportCSV(log) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = flatten(log);
  const lines = [['Дата', 'Время', 'Тип записи', 'Что', 'Детали'], ...rows].map((r) => r.map(q).join(';'));
  download('gut-data.csv', '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
  return rows.length;
}

/** Открывает печатную страницу с дневником за последние 30 дней */
export function openDoctorReport(profile, log, appName) {
  const days = Object.keys(log).sort().slice(-REPORT_DAYS);
  const rows = days.map((k) => {
    const r = { ...emptyDay(), ...log[k] };
    const sc = gutScore(r);
    const stool = r.gut.filter((g) => g.type > 0).map((g) => 'тип ' + g.type).join(', ') || (r.gut.some((g) => g.type === 0) ? 'не было' : '—');
    const sym = [...new Set(r.gut.flatMap((g) => g.sym || []).filter((s) => s !== SYMPTOM_OK))].join(', ') || '—';
    const food = r.meals.map((m) => m.name).join(', ') || '—';
    return '<tr>' + [k, stool, sym, food, r.period ? 'да' : '', sc ? sc.idx + '%' : '—'].map((c) => '<td>' + escapeHtml(c) + '</td>').join('') + '</tr>';
  }).join('');

  const who = [profile.name, profile.age ? profile.age + ' лет' : '', profile.sex === 'f' ? 'жен.' : profile.sex === 'm' ? 'муж.' : ''].filter(Boolean).join(' · ');
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Отчёт для врача</title>
<style>body{font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#1C1A22;margin:32px}h1{font-size:22px;margin:0 0 4px}p{color:#5F5A67;margin:0 0 20px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #E2DFE8;padding:8px 6px;text-align:left;vertical-align:top}th{font-size:12px;color:#5F5A67;font-weight:500}.note{margin-top:24px;font-size:12px;color:#78737F}@media print{body{margin:12mm}}</style></head><body>
<h1>Дневник кишечника</h1><p>${escapeHtml(who)} · последние ${days.length} дн. · ${escapeHtml(appName)}</p>
<table><thead><tr><th>Дата</th><th>Стул (Бристоль)</th><th>Симптомы</th><th>Еда</th><th>Месячные</th><th>Работа кишечника</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6">Записей пока нет</td></tr>'}</tbody></table>
<div class="note">Данные внесены пользователем самостоятельно. Показатель «работа кишечника» — ориентир приложения, не медицинский показатель.</div>
<script>setTimeout(function(){window.print()},400)</script></body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  else download('doctor-report.html', html, 'text/html;charset=utf-8');
}
