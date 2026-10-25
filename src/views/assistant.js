// ИИ-помощник: панель, которая выезжает снизу поверх любого экрана. Открывается круглой кнопкой рядом с меню.
import { AI_SUGGESTED_QUESTIONS } from '../domain/catalog.js';
import { isAndroid } from '../services/telegram.js';

const ASK_MAX_PX = 136; // как max-height у .ask-input: дальше поле прокручивается

const autoSizeCss = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('field-sizing', 'content');
const askHeights = new WeakMap(); // поле → { value, h }: меряем только когда текст изменился

/** Высота поля под текст: растёт по строкам до ASK_MAX_PX. Где браузер умеет field-sizing — это делает CSS. */
function fitAsk(el) {
  if (!el || autoSizeCss) return;
  // morphdom при каждой перерисовке снимает inline-стиль, поэтому высоту ставим всегда, а меряем — только при новом тексте
  const prev = askHeights.get(el);
  if (prev && prev.value === el.value) { el.style.height = prev.h; return; }
  el.style.height = 'auto';
  const h = Math.min(el.scrollHeight + 2, ASK_MAX_PX) + 'px';
  el.style.height = h;
  askHeights.set(el, { value: el.value, h });
}

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
    fitAsk,
    // Enter — отправить, Shift+Enter — новая строка; длинный текст переносится сам
    onAskKey: (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      if (canSend) app.ask(s.askText.trim(), 'custom');
    },
    showChatCamera: isAndroid(),
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
    // вниз — только когда появилось новое сообщение или кусок ответа, а не на каждую букву в поле;
    // крутим саму ленту, а не страницу (scrollIntoView сдвигал весь экран вместе с клавиатурой)
    scrollChat: (el) => {
      if (!el || !s.chat.length) return;
      const last = s.chat[s.chat.length - 1];
      const key = s.chat.length + ':' + String(last.shown != null ? last.shown : last.text).length + ':' + s.chatLoading;
      if (app.chatScroll && app.chatScroll.el === el && app.chatScroll.key === key) return;
      app.chatScroll = { el, key };
      const box = el.closest('.sheet-body');
      if (box) box.scrollTop = box.scrollHeight;
    }
  };
}
