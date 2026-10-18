// Блок «Спросить ИИ» — одинаковый на главной и в инсайтах. Разговор общий для обоих экранов.
import { AI_SUGGESTED_QUESTIONS } from '../domain/catalog.js';

/** screen: 'today' | 'insights' — от него зависят вопросы-подсказки */
export function askView(app, screen) {
  const ai = app.state.ai;
  return {
    suggestions: AI_SUGGESTED_QUESTIONS[screen].map((q) => ({ q, pick: () => app.ask(q, 'suggestion') })),
    hasChat: !!ai.question,
    question: ai.question,
    answer: ai.loading ? 'Думаю…' : ai.answer,
    answerCls: 'card bubble-a' + (ai.loading ? ' pulse' : ''),
    askText: app.state.askText,
    onAskInput: (e) => app.setState({ askText: e.target.value }),
    sendAsk: () => app.ask(app.state.askText.trim(), 'custom')
  };
}
