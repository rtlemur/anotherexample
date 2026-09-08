// Display-only tokenization: text nodes keep URLs and request bodies inert.
function highlightCode(element, source) {
  const tokens = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(async|await|const|let|function|return|try|catch|if|else|true|false)\b|\b\d+\b/g;
  element.replaceChildren();
  let offset = 0;
  for (const match of source.matchAll(tokens)) {
    element.append(document.createTextNode(source.slice(offset, match.index)));
    const span = document.createElement('span');
    span.className = match[1] ? 'token-string' : match[2] ? 'token-keyword' : 'token-number';
    span.textContent = match[0];
    element.append(span);
    offset = match.index + match[0].length;
  }
  element.append(document.createTextNode(source.slice(offset)));
  element.tabIndex = 0;
  element.setAttribute('aria-label', 'Generated JavaScript code');
}
function resultBadge(label, style) {
  const badge = document.createElement('span');
  badge.className = 'badge ' + style;
  badge.textContent = label;
  return badge;
}
function copyControl(id, getText) {
  const button = document.getElementById(id);
  const label = button.textContent.trim();
  const feedback = document.createElement('span');
  feedback.className = 'small';
  feedback.setAttribute('role', 'status');
  button.after(feedback);
  let timer;
  button.onclick = async () => {
    clearTimeout(timer);
    try {
      await navigator.clipboard.writeText(getText());
      button.textContent = 'Copied';
      feedback.textContent = id === 'copyUrl' ? 'Endpoint URL copied.' : 'Code copied.';
    } catch {
      feedback.textContent = 'Copy failed. Allow clipboard access and try again.';
    }
    timer = setTimeout(() => { button.textContent = label; feedback.textContent = ''; }, 1600);
  };
}
