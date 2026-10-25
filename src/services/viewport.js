// Высота приложения = видимая область над клавиатурой.
// На телефоне (особенно iOS в Telegram) клавиатура не уменьшает страницу, а сдвигает её вверх:
// экран «скачет», а низ панели ИИ уходит под клавиатуру. Подгоняем #app под visualViewport (--app-h)
// и возвращаем сдвиг страницы в 0 — тогда шторка всегда стоит ровно над клавиатурой.
export function trackViewport() {
  const vv = typeof window !== 'undefined' && window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let raf = 0;
  const update = () => {
    raf = 0;
    root.style.setProperty('--app-h', Math.round(vv.height) + 'px');
    if (window.scrollY || vv.offsetTop) window.scrollTo(0, 0);
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  update();
}
