const $ = id => document.getElementById(id);

function renderDiagnosis(diagnosis) {
  const explanationBox = $('browserExplanation');
  const title = document.createElement('h3');
  const explanation = document.createElement('p');
  title.textContent = diagnosis.title;
  explanation.textContent = diagnosis.explanation;
  explanationBox.className = 'status';
  explanationBox.replaceChildren(title, explanation);

  $('preflightSummary').textContent = diagnosis.summary;
  $('preflightChecks').replaceChildren(...diagnosis.checks.map(check => {
    const item = document.createElement('li');
    item.textContent = check;
    return item;
  }));
  $('preflightDiagnosisPanel').hidden = false;
}

function bindBrowserResultInterpreter() {
  const input = $('browserResult');
  let timer;
  let composing = false;
  let lastDiagnosis = null;

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
    $('continueDebugger').disabled = !input.value.trim();
    if (!input.value.trim()) {
      lastDiagnosis = null;
      $('browserExplanation').className = '';
      $('browserExplanation').replaceChildren();
      $('preflightDiagnosisPanel').hidden = true;
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
    $('continueDebugger').disabled = !input.value.trim();
    $('handoffStatus').textContent = '';
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
  $('continueDebugger').onclick = () => {
    const error = input.value.trim();
    if (!error) return;
    if (error.length > 16384) {
      $('handoffStatus').textContent = 'Keep the Console error under 16 KB before continuing.';
      return;
    }
    try {
      sessionStorage.setItem('anotherexample.corsDebugger.error.v1', error);
    } catch {
      $('handoffStatus').textContent = 'This browser could not carry the error over. Copy it and open the CORS Debugger from the navigation.';
      return;
    }
    location.assign('/cors?from=explainer');
  };
}
bindBrowserResultInterpreter();
