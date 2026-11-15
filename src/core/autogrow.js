// Поле, которое растёт вниз по мере ввода, а не уезжает текстом вбок (описание еды).
// Вешается как ref="{{fn}}": рантайм вызывает его после каждой отрисовки, в т. ч. после каждого символа.
// Высоту ставим напрямую в style — morphdom её сбрасывает при перерисовке, ref тут же ставит заново.
export function autogrow(maxPx = 160) {
  return (el) => {
    if (!el) return;
    el.style.height = 'auto';
    const h = Math.min(el.scrollHeight + (el.offsetHeight - el.clientHeight), maxPx);
    el.style.height = h + 'px';
    el.style.overflowY = el.scrollHeight > maxPx ? 'auto' : 'hidden';
  };
}
