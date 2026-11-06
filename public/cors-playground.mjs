import { checkPreflight, compare, controlOriginFor, diagnosis, evidenceHeaders, fetchSnippet, makeConfig, makeControl, parseEvidence, preflightCommand, scenariosFor, supportsProbe } from "/cors-playground-core.mjs?v=2";

const get = id => document.getElementById(id);
const form = get("request-form");
const field = {
  url: get("target"), method: get("method"), credentials: get("credentials"), redirect: get("redirect"),
  expected: get("expected"), status: get("expected-status"), headers: get("headers"),
  body: get("body"), contentType: get("content-type"),
};
const origin = location.origin;
const scenarios = scenariosFor(origin);
const runButton = get("run");
const statusLine = get("run-status");
const errorLine = get("form-error");
let lastRun;
let edited = false;
get("page-origin").textContent = origin;
get("control-host").textContent = new URL(controlOriginFor(origin)).host;

function config() {
  return makeConfig(Object.fromEntries(Object.entries(field).map(([name, input]) => [name, input.value])), origin);
}

function applyScenario() {
  const example = scenarios[get("scenario").value];
  if (!example) {
    field.url.value = "";
    field.status.value = "";
    field.expected.value = "readable";
    field.url.focus();
    return;
  }
  for (const [key, value] of Object.entries({ method: "GET", credentials: "omit", redirect: "follow", status: "", headers: "", body: "", contentType: "", ...example })) {
    field[key].value = value;
  }
  get("options").open = Boolean(example.headers || example.body);
}

function prediction(request) {
  const shape = request.shape;
  if (!shape.crossOrigin) return "Same origin · no CORS preflight on the initial request";
  if (!shape.required) return "No CORS preflight predicted for this request";
  const reasons = [...(shape.methodNeedsCheck ? [request.method] : []), ...shape.names];
  return "CORS preflight expected · " + reasons.join(", ");
}

function updateForm() {
  get("body-options").hidden = ["GET", "HEAD"].includes(field.method.value);
  field.status.disabled = field.expected.value !== "readable";
  try {
    const request = config();
    get("prediction").textContent = prediction(request);
    highlightCode(get("fetchCode"), fetchSnippet(request));
    get("copyFetch").disabled = get("copyUrl").disabled = false;
  } catch {
    get("prediction").textContent = "Enter a valid request to predict preflight";
    get("fetchCode").textContent = "Enter a valid request to generate code.";
    get("copyFetch").disabled = get("copyUrl").disabled = true;
  }
}

function markEdited() {
  edited = true;
  errorLine.hidden = true;
  if (lastRun && !runButton.disabled) statusLine.textContent = "Results reflect the last run. Run again to test your changes.";
  updateForm();
}

get("scenario").addEventListener("change", () => { applyScenario(); markEdited(); });
form.addEventListener("input", event => {
  if (event.target === get("scenario")) return;
  if (event.target === field.url) get("scenario").value = "custom";
  markEdited();
});
copyControl("copyFetch", () => fetchSnippet(config()));
copyControl("copyUrl", () => config().url);
applyScenario();
updateForm();

function el(tag, value, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function disclosure(summary) {
  const node = el("details");
  node.append(el("summary", summary));
  return node;
}

function codeBlock(value) {
  const node = el("pre", value);
  node.tabIndex = 0;
  return node;
}

function button(label) {
  const node = el("button", label);
  node.type = "button";
  return node;
}

async function responsePreview(response) {
  if (!response.body) return "No response body.";
  const type = response.headers.get("content-type") || "";
  if (type && !/^(?:text\/|application\/(?:[^;]+\+)?(?:json|xml|x-www-form-urlencoded)(?:;|$))/i.test(type)) {
    await response.body.cancel().catch(() => {});
    return "Preview omitted for " + type + ".";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const limit = 8192;
  let bytes = 0;
  let text = "";
  try {
    while (bytes < limit) {
      const { value, done } = await reader.read();
      if (done) return (text + decoder.decode()) || "Empty response body.";
      const remaining = limit - bytes;
      text += decoder.decode(value.subarray(0, remaining), { stream: true });
      bytes += value.byteLength;
    }
    await reader.cancel().catch(() => {});
    return text + decoder.decode() + "\n… Preview limited to 8 KB.";
  } finally { reader.releaseLock(); }
}

async function browserFetch(request) {
  const controller = new AbortController();
  const start = performance.now();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(request.url, {
      mode: "cors", method: request.method, headers: request.headers, body: request.body,
      credentials: request.credentials, redirect: request.redirect, referrerPolicy: "no-referrer", signal: controller.signal,
    });
    const elapsed = Math.round(performance.now() - start);
    if (!response.status) return { kind: "unexpected", elapsed };
    const preview = await responsePreview(response).catch(() => "Response headers arrived. The body preview could not be read.");
    return {
      kind: "readable", status: response.status, statusText: response.statusText, elapsed, preview,
      headers: [...response.headers], url: response.url, redirected: response.redirected, type: response.type,
    };
  } catch {
    return { kind: controller.signal.aborted ? "timeout" : "failed", elapsed: Math.round(performance.now() - start) };
  } finally { clearTimeout(timeout); }
}

async function probe(request) {
  if (!request.shape.required || !supportsProbe(request.url)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8500);
  try {
    const response = await fetch("/api/cors/preflight-probe", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ url: request.url, origin, method: request.method, names: request.shape.names }),
    });
    const result = await response.json();
    return response.ok ? result : { error: result.error || "The separate OPTIONS probe was unavailable." };
  } catch {
    return { error: "The separate OPTIONS probe was unavailable." };
  } finally { clearTimeout(timeout); }
}

function expectedText(request) {
  if (request.expected === "failed") return "Browser cannot read the response";
  return "Readable response" + (request.expectedStatus === null ? "" : " · HTTP " + request.expectedStatus);
}

function observedText(result) {
  if (result.kind === "readable") return "Readable · HTTP " + result.status + (result.statusText ? " " + result.statusText : "");
  if (result.kind === "timeout") return "Timed out";
  if (result.kind === "unexpected") return "Response unavailable";
  return "Browser could not read a response";
}

function renderResponse(result) {
  const detail = disclosure("Response details");
  if (result.kind !== "readable") {
    detail.append(el("p", "Fetch didn’t expose an HTTP status, headers, or body. DevTools can show the browser’s exact failure.", "muted"));
    return detail;
  }
  detail.append(
    el("p", "Fetch response type " + result.type + (result.redirected ? " · redirected" : ""), "muted evidence-note"),
    el("p", "Final URL " + result.url, "endpoint mono"),
    el("h4", "Headers visible to JavaScript"),
    codeBlock(result.headers.map(([name, value]) => name + ": " + value).join("\n") || "No headers exposed."),
    el("p", "Cross-origin reads expose safelisted response headers and any additional headers the server exposes.", "muted evidence-note"),
    el("h4", "Body preview"), codeBlock(result.preview),
  );
  return detail;
}

function renderEvidence(container, request, evidence) {
  container.replaceChildren();
  if (!evidence) return;
  if (evidence.error) {
    container.append(el("p", evidence.error, "muted evidence-note"));
    return;
  }
  const names = evidenceHeaders.filter(name => name in evidence.headers);
  const headers = names.map(name => name + ": " + evidence.headers[name]);
  const issue = checkPreflight(request, evidence, origin);
  container.append(el("h4", evidence.source + " · HTTP " + evidence.status),
    el("p", issue ? issue[0] : "These OPTIONS headers allow the configured request.", "muted"),
    codeBlock(headers.join("\n") || "No CORS response headers in this evidence."));
}

function renderPreflight(request, evidence, isTarget) {
  const detail = disclosure("Preflight · " + (request.shape.required ? "expected" : "not predicted"));
  detail.open = request.shape.required;
  detail.append(el("p", prediction(request), "evidence-note"));
  if (!request.shape.required) {
    detail.append(el("p", request.shape.crossOrigin ? "The initial method and request headers are CORS-safelisted." : "This URL starts on the same origin as the playground.", "muted"));
    return detail;
  }
  detail.append(el("p", "Fetch doesn’t expose the browser’s OPTIONS response. Its preflight cache can also satisfy this check.", "muted evidence-note"));
  const evidenceBox = el("div");
  renderEvidence(evidenceBox, request, evidence);
  detail.append(evidenceBox);
  const troubleshooting = disclosure("Inspect OPTIONS yourself");
  troubleshooting.open = !evidence || Boolean(evidence.error);
  troubleshooting.append(el("p", "In DevTools, open Network and look for OPTIONS. Or run this credential-free probe in a terminal.", "muted"));
  const command = preflightCommand(request, origin);
  const copy = button("Copy OPTIONS command");
  const note = el("span", "", "muted small");
  note.setAttribute("role", "status");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(command);
      note.textContent = "Copied.";
    } catch { note.textContent = "Select the command below to copy it."; }
  });
  const toolbar = el("div", undefined, "evidence-tools");
  toolbar.append(copy, note);
  troubleshooting.append(toolbar, codeBlock(command));
  if (isTarget) {
    const label = el("label", "Paste OPTIONS response to analyze");
    const input = el("textarea");
    input.rows = 3;
    input.maxLength = 16384;
    input.placeholder = "HTTP/2 204";
    input.spellcheck = false;
    label.append(input);
    const apply = button("Analyze pasted response");
    const feedback = el("p", "", "error");
    feedback.setAttribute("role", "status");
    apply.addEventListener("click", () => {
      try {
        const parsed = parseEvidence(input.value);
        renderEvidence(evidenceBox, request, parsed);
        renderDiagnosis(parsed);
        feedback.className = "muted small";
        feedback.textContent = "OPTIONS evidence added.";
      } catch (error) {
        feedback.className = "error";
        feedback.textContent = error.message;
      }
    });
    const tools = el("div", undefined, "evidence-tools");
    tools.append(apply, feedback);
    troubleshooting.append(label, tools);
  }
  detail.append(troubleshooting);
  return detail;
}

function renderResult(id, label, request, result, evidence, isTarget) {
  const top = el("div", undefined, "result-top");
  const match = compare(request, result);
  top.append(el("h3", label), el("span", match.text, "badge " + match.tone));
  const metrics = el("dl", undefined, "outcome");
  metrics.append(el("dt", "Expected"), el("dd", expectedText(request)), el("dt", "Observed"), el("dd", observedText(result)),
    el("dt", "Elapsed"), el("dd", result.elapsed + " ms"));
  get(id).replaceChildren(top, el("p", request.method + " " + request.url, "endpoint mono"), metrics,
    renderPreflight(request, evidence, isTarget), renderResponse(result));
}

function renderDiagnosis(evidence) {
  const { target, baseline, observation } = lastRun;
  const [title, detail, retest] = diagnosis(target, baseline, observation, evidence?.error ? null : evidence, origin);
  const panel = get("diagnosis");
  panel.classList.toggle("good", observation.kind === "readable" && compare(target, observation).tone === "good");
  panel.replaceChildren(el("h3", title), el("p", detail));
  if (retest) {
    const next = el("p");
    next.append(el("strong", "Retest "), document.createTextNode(retest));
    panel.append(next);
  }
  panel.hidden = false;
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (runButton.disabled) return;
  let target;
  try {
    if (field.status.validity.badInput && !field.status.disabled) throw new Error("Enter a whole HTTP status, or leave it blank.");
    target = config();
  } catch (error) {
    errorLine.textContent = error.message;
    errorLine.hidden = false;
    return;
  }
  errorLine.hidden = true;
  edited = false;
  runButton.disabled = true;
  get("results").setAttribute("aria-busy", "true");
  statusLine.textContent = "Running both requests…";
  const control = makeControl(target, origin);
  try {
    const [baseline, observation, controlEvidence, targetEvidence] = await Promise.all([
      browserFetch(control), browserFetch(target), probe(control), probe(target),
    ]);
    lastRun = { target, baseline, observation };
    renderResult("control-result", "Known-good control", control, baseline, controlEvidence, false);
    renderResult("target-result", "Target", target, observation, targetEvidence, true);
    renderDiagnosis(targetEvidence);
    get("preflight-note").hidden = !control.shape.required || !target.shape.required;
    statusLine.textContent = edited ? "Results reflect the submitted request. Run again to test your changes." : "Comparison complete · requests sent from this page’s origin.";
  } catch {
    statusLine.textContent = "The comparison could not be displayed. Try the Simple GET test case.";
  } finally {
    runButton.disabled = false;
    get("results").setAttribute("aria-busy", "false");
  }
});
