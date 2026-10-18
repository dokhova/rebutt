/** Делит текст на предложения (по . ! ? …), сохраняя знаки препинания */
export function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?…])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}
