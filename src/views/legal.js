// Документ (соглашение, политика, согласие) внутри приложения. Текст — из public/legal/*.html.
export function legalView(app) {
  const doc = app.state.legal;
  return {
    docTitle: doc.title,
    docHtml: doc.html,
    docLoading: !doc.html && !doc.error,
    docError: doc.error,
    closeDoc: () => app.closeLegalDoc(),
    onDocClick: (e) => app.onLegalLinkClick(e)
  };
}
