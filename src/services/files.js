// Сжатие фото перед отправкой в ИИ и экспорт данных (CSV / отчёт для врача)

export function compressImage(file, max = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image_decode_failed')); };
    img.src = url;
  });
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const TYPES = { 1: 'Твёрдые комки', 2: 'Комковатая', 3: 'С трещинами', 4: 'Гладкая', 5: 'Мягкие комочки', 6: 'Кашица', 7: 'Жидкий' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function rows(log) {
  const out = [];
  Object.keys(log).sort().forEach((k) => {
    const r = log[k];
    (r.gut || []).forEach((g) => out.push({ day: k, time: g.time, kind: 'Стул', what: g.type > 0 ? 'Тип ' + g.type + ' — ' + TYPES[g.type] : g.type === 0 ? 'Стула не было' : 'Самочувствие', extra: (g.sym || []).join(', ') }));
    (r.meals || []).forEach((m) => out.push({ day: k, time: m.time, kind: 'Еда', what: m.name, extra: m.kcal + ' ккал, клетчатка ' + m.fiber + ' г' }));
    if (r.period) out.push({ day: k, time: '', kind: 'Цикл', what: 'Месячные', extra: '' });
  });
  return out;
}

export function exportCSV(log) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lines = [['Дата', 'Время', 'Тип записи', 'Что', 'Детали'].map(q).join(';')];
  rows(log).forEach((r) => lines.push([r.day, r.time, r.kind, r.what, r.extra].map(q).join(';')));
  download('gut-data.csv', '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
  return lines.length - 1;
}

// Отчёт для врача: печатная страница → «Сохранить как PDF» в системном диалоге печати
export function openDoctorReport({ profile, log, appName, scoreOf }) {
  const days = Object.keys(log).sort().slice(-30);
  const body = days.map((k) => {
    const r = log[k], sc = scoreOf(r);
    const stool = (r.gut || []).filter((g) => g.type > 0).map((g) => 'тип ' + g.type).join(', ') || ((r.gut || []).some((g) => g.type === 0) ? 'не было' : '—');
    const sym = [...new Set((r.gut || []).flatMap((g) => g.sym || []).filter((s) => s !== 'Всё хорошо'))].join(', ') || '—';
    const food = (r.meals || []).map((m) => m.name).join(', ') || '—';
    return '<tr><td>' + esc(k) + '</td><td>' + esc(stool) + '</td><td>' + esc(sym) + '</td><td>' + esc(food) + '</td><td>' + (r.period ? 'да' : '') + '</td><td>' + (sc ? sc.idx + '%' : '—') + '</td></tr>';
  }).join('');
  const html = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Отчёт для врача</title>' +
    '<style>body{font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#1C1A22;margin:32px}h1{font-size:22px;margin:0 0 4px}p{color:#5F5A67;margin:0 0 20px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #E2DFE8;padding:8px 6px;text-align:left;vertical-align:top}th{font-size:12px;color:#5F5A67;font-weight:500}.n{margin-top:24px;font-size:12px;color:#78737F}@media print{body{margin:12mm}}</style></head><body>' +
    '<h1>Дневник кишечника</h1><p>' + esc([profile.name, profile.age ? profile.age + ' лет' : '', profile.sex === 'f' ? 'жен.' : profile.sex === 'm' ? 'муж.' : ''].filter(Boolean).join(' · ')) + ' · последние ' + days.length + ' дн. · ' + esc(appName) + '</p>' +
    '<table><thead><tr><th>Дата</th><th>Стул (Бристоль)</th><th>Симптомы</th><th>Еда</th><th>Месячные</th><th>Работа кишечника</th></tr></thead><tbody>' + (body || '<tr><td colspan="6">Записей пока нет</td></tr>') + '</tbody></table>' +
    '<div class="n">Данные внесены пользователем самостоятельно. Показатель «работа кишечника» — ориентир приложения, не медицинский показатель.</div>' +
    '<script>setTimeout(function(){window.print()},400)<\/script></body></html>';
  const w = window.open('', '_blank');
  if (w) { w.document.open(); w.document.write(html); w.document.close(); return true; }
  download('doctor-report.html', html, 'text/html;charset=utf-8');
  return true;
}
