const $ = id => document.getElementById(id);

function renderDiagnosis(diagnosis) {
  const explanationBox = $('browserExplanation');
  const preflightPanel = $('preflightDiagnosisPanel');
  const preflightBox = $('preflightDiagnosis');

  explanationBox.style.display = 'block';
  explanationBox.innerHTML =
    '<strong>' + diagnosis.title + '</strong><br>' +
    diagnosis.explanation;

  const badge = diagnosis.mainRequest === 'YES' ? ['200 OK', 'ok'] : diagnosis.preflight === 'YES' ? ['Preflight failed', 'bad'] : diagnosis.preflight === 'MAYBE' ? ['CORS blocked', 'bad'] : null;
  if (badge) explanationBox.prepend(resultBadge(...badge));
  $('preflightSummary').textContent = diagnosis.summary;

  preflightPanel.style.display = 'block';
  preflightBox.className = 'status bad';

  const checks = diagnosis.checks
    .map(check => '• ' + check + '<br>')
    .join('');

  preflightBox.innerHTML =
    '<strong>Preflight likely happened: ' + diagnosis.preflight + '</strong><br>' +
    '<strong>Main request likely sent: ' + diagnosis.mainRequest + '</strong><br><br>' +
    '<strong>Likely cause:</strong><br>' +
    diagnosis.likelyCause +
    '<br><br>' +
    '<strong>Check next:</strong><br>' +
    checks;
}

function bindBrowserResultInterpreter() {
  const input = $('browserResult');
  let timer;
  let composing = false;
  let lastDiagnosis = null;

  // Announce the short explanation politely; keep the detailed checks readable
  // without a second, lengthy live announcement on every edit.
  $('preflightDiagnosis').setAttribute('aria-live', 'off');

  function resizeInput() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight + 2, 220) + 'px';
  }

  function updateContext() {
    const context = extractBrowserContext(input.value);
    const box = $('errorContext');
    box.textContent = [context.origin && 'Page origin: ' + context.origin,
      context.target && 'Target URL: ' + context.target].filter(Boolean).join(' · ');
    box.hidden = !box.textContent;
  }

  function update() {
    clearTimeout(timer);
    updateContext();
    if (!input.value.trim()) {
      lastDiagnosis = null;
      $('browserExplanation').style.display = 'none';
      $('preflightDiagnosisPanel').style.display = 'none';
      return;
    }
    const diagnosis = findBrowserDiagnosis(input.value);
    const signature = JSON.stringify(diagnosis);
    if (signature !== lastDiagnosis) {
      renderDiagnosis(diagnosis);
      lastDiagnosis = signature;
    }
  }

  function schedule() {
    resizeInput();
    clearTimeout(timer);
    if (!input.value.trim()) {
      update();
    } else if (!composing) {
      timer = setTimeout(update, 400);
    }
  }

  input.addEventListener('input', schedule);
  input.addEventListener('compositionstart', () => {
    composing = true;
    clearTimeout(timer);
  });
  input.addEventListener('compositionend', () => {
    composing = false;
    schedule();
  });
  $('explainBrowserResult').onclick = update;
}
bindBrowserResultInterpreter();
