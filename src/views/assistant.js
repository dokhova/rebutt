// ИИ-помощник: панель, которая выезжает снизу поверх любого экрана. Открывается круглой кнопкой рядом с меню.
import { AI_SUGGESTED_QUESTIONS } from '../domain/catalog.js';

export function assistantView(app) {
  const s = app.state;
  const messages = s.chat.map((m) => {
    const isUser = m.role === 'user';
    return {
      text: isUser ? m.text : (m.shown != null ? m.shown : m.text),
      hasText: !!m.text,
      image: m.image || '',
      hasImage: !!m.image,
      cls: isUser ? 'bubble-q' : 'bubble-a'
    };
  });
  const canSend = (s.askText.trim() || s.chatImage) && !s.chatLoading;
  return {
    messages,
    chatLoading: s.chatLoading,
    emptyChat: !s.chat.length,
    suggestions: AI_SUGGESTED_QUESTIONS.map((q) => ({ q, pick: () => app.ask(q, 'suggestion') })),
    askText: s.askText,
    onAskInput: (e) => app.setState({ askText: e.target.value }),
    onAskKey: (e) => { if (e.key === 'Enter' && canSend) { e.preventDefault(); app.ask(s.askText.trim(), 'custom'); } },
    chatImage: s.chatImage,
    hasChatImage: !!s.chatImage,
    onChatImage: (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) app.attachChatImage(file);
    },
    removeChatImage: () => app.removeChatImage(),
    sendCls: 'send' + (canSend ? '' : ' off'),
    sendAsk: () => { if (canSend) app.ask(s.askText.trim(), 'custom'); },
    closeAssistant: () => app.closeAssistant(),
    scrollChat: (el) => { if (el && s.chat.length) el.scrollIntoView({ block: 'end' }); }
  };
}
