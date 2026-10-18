// ИИ-помощник: отдельный экран поверх приложения. Открывается кнопкой «Спросить ИИ».
import { AI_SUGGESTED_QUESTIONS } from '../domain/catalog.js';

export function assistantView(app) {
  const s = app.state;
  const messages = s.chat.map((m) => ({ text: m.text, cls: m.role === 'user' ? 'bubble-q' : 'card bubble-a' }));
  if (s.chatLoading) messages.push({ text: 'Думаю…', cls: 'card bubble-a pulse' });
  return {
    messages,
    emptyChat: !s.chat.length,
    suggestions: AI_SUGGESTED_QUESTIONS.map((q) => ({ q, pick: () => app.ask(q, 'suggestion') })),
    askText: s.askText,
    onAskInput: (e) => app.setState({ askText: e.target.value }),
    sendCls: 'plus' + (s.askText.trim() && !s.chatLoading ? '' : ' off'),
    sendAsk: () => app.ask(s.askText.trim(), 'custom'),
    closeAssistant: () => app.closeAssistant(),
    scrollChat: (el) => { if (el && s.chat.length) el.scrollIntoView({ block: 'end' }); }
  };
}
