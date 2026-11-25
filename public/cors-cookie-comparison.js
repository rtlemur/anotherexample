const ROUTE = '/cors/cookies';
const CHECK = '/api/cookie-comparison/check';
const SETUP = '/api/cookie-comparison/setup';
const MESSAGE_TYPE = 'anotherexample:cookie-comparison';
const REQUEST_TIMEOUT = 8000;
const COMPANION_TIMEOUT = 20000;

const get = id => document.getElementById(id);
const updateStatus = message => { get('status').textContent = message; };
const requestOptions = () => ({
  credentials: 'include',
  cache: 'no-store',
  signal: AbortSignal.timeout(REQUEST_TIMEOUT),
});

function showResult(column, result) {
  get(column + '-cookie').textContent = result.received === null
    ? 'Unknown'
    : result.received ? 'Yes' : 'No';
  get(column + '-readable').textContent = result.readable ? 'Yes' : 'No';
}

function resetResults() {
  for (const column of ['same', 'cross']) {
    get(column + '-cookie').textContent = 'Running…';
    get(column + '-readable').textContent = 'Running…';
  }
  get('explanation').hidden = true;
}

async function checkCookie(primary) {
  try {
    const response = await fetch(primary + CHECK, requestOptions());
    if (!response.ok) return { received: null, readable: true };
    const result = await response.json().catch(() => null);
    return { received: typeof result?.received === 'boolean' ? result.received : null, readable: true };
  } catch {
    return { received: null, readable: false };
  }
}

function checkFromCompanion(companion, secondary, id) {
  return new Promise(resolve => {
    const finish = result => {
      clearTimeout(timeout);
      window.removeEventListener('message', receive);
      resolve(result);
    };
    const receive = event => {
      if (event.source !== companion || event.origin !== secondary) return;
      const data = event.data;
      if (data?.type !== MESSAGE_TYPE || data.id !== id) return;
      if (typeof data.readable !== 'boolean' || ![true, false, null].includes(data.received)) return;
      finish({ received: data.received, readable: data.readable });
    };
    const timeout = setTimeout(() => finish(null), COMPANION_TIMEOUT);
    window.addEventListener('message', receive);
    try {
      companion.location = secondary + ROUTE + '#' + id;
    } catch {
      finish(null);
    }
  });
}

function showComparison({ primary, secondary }) {
  const run = get('run-comparison');
  get('same-origin').textContent = new URL(primary).host;
  get('cross-origin').textContent = new URL(secondary).host;
  get('comparison').hidden = false;
  updateStatus('');

  run.addEventListener('click', async () => {
    const companion = window.open('about:blank', '_blank');
    if (!companion) {
      updateStatus('Allow pop-ups for this page and try again.');
      return;
    }
    run.disabled = true;
    resetResults();
    updateStatus('Setting the demo cookie and running both checks…');

    try {
      const setup = await fetch(primary + SETUP, { ...requestOptions(), method: 'POST' });
      if (!setup.ok) throw new Error('Demo cookie setup failed.');

      const id = crypto.randomUUID();
      const sameCheck = checkCookie(primary).then(result => {
        showResult('same', result);
        return result;
      });
      const [same, cross] = await Promise.all([sameCheck, checkFromCompanion(companion, secondary, id)]);
      if (!cross) {
        get('cross-cookie').textContent = 'Unknown';
        get('cross-readable').textContent = 'Unknown';
        updateStatus('The second site did not send back a result. Check the tab it opened and try again.');
        return;
      }

      showResult('cross', cross);
      get('explanation').hidden = !(same.received === true && cross.received === false && cross.readable);
      updateStatus('Comparison complete.');
    } catch {
      companion.close();
      for (const column of ['same', 'cross']) {
        get(column + '-cookie').textContent = 'Unavailable';
        get(column + '-readable').textContent = 'Unavailable';
      }
      updateStatus('The demo cookie could not be set up. Try again.');
    } finally {
      run.disabled = false;
    }
  });
}

async function showCompanion({ primary }) {
  get('target').textContent = 'Requesting ' + new URL(primary).host + ' from ' + location.host + '.';
  get('back-to-comparison').href = primary + ROUTE;
  get('cross-site-page').hidden = false;
  updateStatus('Checking the demo cookie…');

  const result = await checkCookie(primary);
  showResult('companion', result);
  updateStatus('Cross-site check complete.');

  const id = location.hash.slice(1);
  if (window.opener && /^[\da-f-]{36}$/i.test(id)) {
    window.opener.postMessage({ type: MESSAGE_TYPE, id, ...result }, primary);
  }
}

async function start() {
  const response = await fetch('/cookie-comparison-config.json', { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!response.ok) throw new Error('Could not load the comparison configuration.');
  const config = await response.json();
  get('playground-link').href = config.primary + '/cors/playground';

  if (location.origin === config.primary) showComparison(config);
  else if (location.origin === config.secondary) await showCompanion(config);
  else updateStatus('This address has not been configured for the cookie comparison.');
}

start().catch(() => updateStatus('The cookie comparison could not load. Reload the page to try again.'));
