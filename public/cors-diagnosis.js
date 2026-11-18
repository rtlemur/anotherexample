function browserDiagnosis(family, title, side, explanation, checks, preflight = 'MAYBE') {
  return {
    family, title, side,
    explanation: side ? explanation + ' Inspect the ' + side + ' first.' : explanation,
    summary: preflight === 'YES'
      ? 'The browser may have stopped before sending the main request.'
      : 'This message alone does not establish whether a preflight occurred.',
    preflight,
    mainRequest: preflight === 'YES' ? 'NO' : 'UNKNOWN',
    likelyCause: explanation,
    checks
  };
}

function preflightFailureChecks(status) {
  const inspect = 'Check the OPTIONS status and response headers in DevTools → Network.';
  const auth = 'For a 401 or 403, check whether login middleware or proxy access rules reject OPTIONS. Handle CORS preflights for approved origins and keep authentication on the actual API request.';
  const route = 'For a 404 or 405, check that the server or proxy has an OPTIONS handler for that URL.';
  if (status === 401 || status === 403) return [inspect, auth];
  if (status === 404 || status === 405) return [inspect, route];
  return [inspect, auth, route, 'If no response arrived, check connectivity and TLS.'];
}

const browserDiagnosisRules = [
  {
    matches: t => /access-control-allow-origin|\bacao\b/.test(t) && /multiple|more than one|only one.*allowed/.test(t),
    diagnosis: browserDiagnosis('multiple-origin', 'Multiple allowed-origin headers', 'server',
      'The response supplies multiple Access-Control-Allow-Origin headers or values; the browser requires a single allowed origin.',
      ['Inspect raw response headers in DevTools or server logs', 'Check whether both the application and proxy add the header', 'Return one allowed origin, not a comma-separated list'])
  },
  {
    matches: t => /credential/.test(t) && (/wildcard/.test(t) || /access-control-allow-origin[^\n]*\*/.test(t) || /explicit (?:allowed )?origin/.test(t)),
    diagnosis: browserDiagnosis('credentials-wildcard', 'Credentials cannot use a wildcard origin', 'server',
      'Credentialed requests require an explicit allowed origin instead of Access-Control-Allow-Origin: *.',
      ['Return the exact permitted requesting origin', 'Return Access-Control-Allow-Credentials: true for permitted credentialed requests', 'Check whether the client actually needs credentials'])
  },
  {
    matches: t => /access-control-allow-credentials/.test(t) && /missing|expected|must be|not.*true|invalid|is not|does not|is \'\'/.test(t),
    diagnosis: browserDiagnosis('allow-credentials', 'Missing or invalid Allow-Credentials', 'server',
      'The credentialed request requires Access-Control-Allow-Credentials with the case-sensitive value true; the message reports it missing or invalid.',
      ['Inspect the OPTIONS and final response in DevTools or server logs', 'Return Access-Control-Allow-Credentials: true for approved credentialed access', 'Check whether the client sends credentials (credentials: "include" or withCredentials = true)'])
  },
  {
    matches: t => /access-control-allow-methods/.test(t) && /not allowed|missing|absent|did not find|invalid token|not (?:present|listed|permitted)/.test(t),
    diagnosis: browserDiagnosis('method', 'Method rejected by preflight', 'server',
      'The allowed-methods response omits the requested method or contains an invalid method token.',
      ['Compare Access-Control-Request-Method with Access-Control-Allow-Methods', 'Use valid comma-separated HTTP method tokens', 'Check that OPTIONS receives a successful response'], 'YES')
  },
  {
    matches: t => /access-control-allow-headers/.test(t) && /not allowed|missing|absent|did not find|invalid token|not (?:present|listed|permitted)/.test(t),
    diagnosis: browserDiagnosis('header', 'Request header rejected by preflight', 'server',
      'The allowed-headers response omits a requested header or contains an invalid header-name token.',
      ['Compare Access-Control-Request-Headers with Access-Control-Allow-Headers', 'Use valid comma-separated header names', 'Check that OPTIONS receives a successful response'], 'YES')
  },
  {
    matches: t => /access-control-allow-origin|returned origin/.test(t) && /does not match|doesn\'t match|mismatch|different origin/.test(t),
    diagnosis: browserDiagnosis('origin-mismatch', 'Allowed origin does not match', 'server',
      'The response names an allowed origin different from the requesting page origin.',
      ['Compare the page origin with the response header in DevTools', 'Check scheme, hostname, and port', 'Check proxy configuration and cached responses for the wrong origin'])
  },
  {
    // Be precise only when the browser explicitly identifies a missing header.
    matches: t => /access-control-allow-origin/.test(t) &&
      (/no ['"]?access-control-allow-origin['"]? header is present/.test(t) ||
        /(?:missing|absent) ['"]?access-control-allow-origin['"]? header/.test(t) ||
        /header ['"]?access-control-allow-origin['"]? (?:is )?(?:missing|absent|not present)\b/.test(t) ||
        /access-control-allow-origin['"]? header (?:is )?(?:missing|absent|not present)/.test(t)),
    diagnosis: browserDiagnosis('missing-origin', 'Missing Access-Control-Allow-Origin header', 'server',
      'The browser reports that the response is missing the Access-Control-Allow-Origin header, so JavaScript on your page cannot read it.',
      ['Check the API server or reverse proxy response headers', 'Return Access-Control-Allow-Origin with the exact permitted page origin (or * for non-credentialed public resources)', 'Check error responses and proxy responses, which may omit CORS headers'])
  },
  {
    matches: t => /access-control-allow-origin/.test(t) && /missing|no ["']?access-control-allow-origin["']? header|origin .*not allowed by/.test(t),
    diagnosis: browserDiagnosis('missing-origin', 'Origin not allowed by server', 'server',
      'The browser reports an origin that the server may not permit. This message alone does not establish whether the allowed-origin header is missing or has the wrong value.',
      ['Inspect the OPTIONS and final response headers in DevTools or server logs', 'Ensure the server permits the exact page origin', 'Check error responses and proxy responses for missing headers'])
  },
  {
    matches: t => /redirect/.test(t) && /not allowed|not permitted|disallowed|blocked/.test(t) && /cors|cross-origin|preflight/.test(t),
    diagnosis: browserDiagnosis('redirect', 'CORS redirect blocked', 'server',
      'The browser reports a redirect it cannot follow during CORS processing. This may affect a preflight or the main request.',
      ['Inspect the redirect chain and Location in DevTools or server logs', 'Use the final API URL directly', 'Check authentication, HTTPS, and proxy redirects on OPTIONS'])
  },
  {
    matches: t => /cors request not https?\b|cross origin requests are only supported for protocol schemes|url scheme .*not supported|unsupported (?:url )?scheme/.test(t) ||
      (/cors|cross-origin|cross origin/.test(t) && /(?:file|[a-z][a-z0-9+.-]*):\/\//.test(t) && /scheme|protocol/.test(t) && /not|only|unsupported|blocked/.test(t)),
    diagnosis: browserDiagnosis('scheme', 'Unsupported request scheme', 'client',
      'The request uses a scheme the browser does not support for this cross-origin fetch, such as file:// or a custom protocol.',
      ['Serve local pages through an HTTP or HTTPS development server', 'Check the target URL scheme', 'Use an HTTP or HTTPS API URL'], 'UNKNOWN')
  },
  {
    matches: t => /\b(?:err_name_not_resolved|ns_error_unknown_host|dns_probe_finished_nxdomain)\b|server with the specified hostname could not be found/.test(t),
    diagnosis: browserDiagnosis('dns', 'DNS lookup failed', 'network',
      'The browser reports that it could not resolve the target hostname.',
      ['Check the target URL for a misspelled hostname', 'Check whether the hostname resolves on the same device and network', 'For a private hostname, check whether you need a VPN or internal DNS'], 'UNKNOWN')
  },
  {
    matches: t => /\berr_(?:connection_[a-z_]+|timed_out|cert_[a-z_]+|ssl_[a-z_]+)\b/.test(t),
    diagnosis: browserDiagnosis('transport', 'Connection or TLS failure', 'network',
      'The browser reports a connection error, timeout, or TLS error.',
      ['Check the exact error for this request in DevTools → Network', 'Verify that the host and port are reachable and the HTTPS certificate is valid'], 'UNKNOWN')
  },
  {
    matches: t => /\bpreflight (?:request|response|channel|status)\b.*(?:unsuccessful|did not succeed|fail|reject|not.*(?:ok|successful|2xx)|doesn't pass|does not pass)/.test(t) ||
      /\b(?:non-2xx preflight status|options request (?:was )?rejected|preflight (?:failed|rejected))\b/.test(t),
    diagnosis: browserDiagnosis('preflight', 'Preflight failed', null,
      'The browser tried to check cross-origin permissions with an OPTIONS request.',
      preflightFailureChecks(), 'YES')
  },
  {
    matches: t => /cors request did not succeed|failed to fetch|load failed|networkerror when attempting to fetch resource|network request failed|request timed out|network connection was lost|could not connect to the server|mixed content.*(?:blocked|insecure)|(?:tls|ssl|certificate|dns|connection).*(?:error|failed|failure|invalid|expired|refused|timed out)/.test(t),
    diagnosis: browserDiagnosis('network', 'CORS or network failure — cause unclear', 'network',
      'This may not be a CORS configuration problem. The message alone cannot distinguish CORS from connectivity, DNS, TLS, mixed-content blocking, or another browser restriction.',
      ['Look for a more specific Console or Network error for the same request', 'Check target availability, DNS, and TLS certificates', 'Check for an HTTPS page requesting an insecure HTTP resource', 'Inspect OPTIONS and the main request in DevTools; blocked headers are not available to page JavaScript'], 'UNKNOWN')
  }
];

function rejectedRequestHeader(message) {
  const name = message.match(/\brequest header field (\S+) is not allowed by access-control-allow-headers\b/i)?.[1] ??
    message.match(/\bmissing token ['"](\S+)['"] in cors header ['"]access-control-allow-headers['"]/i)?.[1];
  if (!name || name === '*' || !/^[!#$%&'*+.^_\x60|~\w-]+$/.test(name)) return null;
  return name.toLowerCase() === 'authorization' ? 'Authorization' : name;
}

function browserDiagnosisWithEvidence(base, text, message, status, preflight) {
  const { family, title, side } = base;
  let { likelyCause, checks } = base;
  if (family === 'missing-origin' && status >= 200 && status < 300) {
    likelyCause = 'The message reports HTTP ' + status + '. ' + likelyCause;
  }
  if (family === 'header') {
    const header = rejectedRequestHeader(message);
    if (header) {
      likelyCause = 'The OPTIONS response does not allow the ' + header + ' request header.';
      checks = [
        'For requests you intend to allow, add ' + header + ' to Access-Control-Allow-Headers on the OPTIONS response.',
        ...checks.slice(1)
      ];
    }
  }
  if (family === 'redirect') {
    const { origin, target, redirectedFrom } = extractBrowserContext(text);
    if (origin?.startsWith('https://') && /^http:\/\//i.test(redirectedFrom || target || '')) {
      const reportedUpgrade = redirectedFrom && /^https:\/\//i.test(target);
      likelyCause += reportedUpgrade
        ? ' The message shows an HTTP-to-HTTPS redirect.'
        : ' The page uses HTTPS and the API URL starts with HTTP.';
      checks = [
        checks[0],
        reportedUpgrade
          ? 'Use the final HTTPS API URL directly if it is the intended endpoint.'
          : 'Check whether the HTTP URL redirects to HTTPS. If it does, use the final HTTPS API URL directly.',
        checks[2]
      ];
    }
  }
  if (family === 'preflight' && status >= 300) {
    likelyCause = 'The message reports HTTP ' + status + '. Confirm that status on the OPTIONS request in DevTools → Network.';
    checks = preflightFailureChecks(status);
  }
  return browserDiagnosis(family, title, side, likelyCause, checks, preflight);
}

function findBrowserDiagnosis(text) {
  const message = String(text || '').trim()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ');
  const normalized = message.toLowerCase();
  const base = browserDiagnosisRules.find(rule => rule.matches(normalized))?.diagnosis;
  const namesPreflight = /\b(?:response to (?:the )?preflight request|cors preflight channel did not succeed|(?:in|on|from|for) (?:a |the |cors )?preflight (?:request|response|channel))\b/.test(normalized);
  // Require a status label, HTTP prefix, or standard status reason; a URL port
  // or arbitrary number alongside the word CORS is not HTTP-error evidence.
  const statusMatches = normalized.matchAll(/(?:^|[\s(])(?:status(?: code| of)?|http(?:\/\d(?:\.\d+)?)?)[\s:='"(]+([2-5]\d{2})\b|\b([45]\d{2})\s+\(?(?:bad request|unauthorized|forbidden|not found|method not allowed|internal server error|bad gateway|service unavailable|gateway timeout)\b/g);
  const statuses = [...new Set(Array.from(statusMatches, match => Number(match[1] || match[2])))];
  const status = statuses.length === 1 ? statuses[0] : undefined;
  const httpError = statuses.some(code => code >= 400);
  const corsComplaint = base && !['dns', 'transport', 'network', 'scheme'].includes(base.family) ||
    /blocked by cors|cors (?:error|request did not succeed)|access.control (?:check|checks).*fail/.test(normalized);
  const preflight = namesPreflight ? 'YES' : base?.preflight;
  let diagnosis;
  if (httpError && corsComplaint && base?.family !== 'preflight') {
    diagnosis = browserDiagnosis('http-error', 'HTTP error with a CORS complaint', 'server',
      'The message includes a 4xx/5xx response and a CORS complaint. The underlying server or upstream error may be the primary problem; its error response may simply lack CORS headers. Confirm both messages refer to the same request.',
      preflight === 'YES'
        ? preflightFailureChecks(status)
        : ['Correlate the status and CORS message with the same URL in DevTools', 'Inspect server and proxy logs for the underlying HTTP error', 'Check CORS headers on error responses as well as successful responses', 'Do not rely on page JavaScript to read a blocked response'],
      preflight === 'YES' ? 'YES' : 'MAYBE');
  } else if (base) {
    diagnosis = browserDiagnosisWithEvidence(base, text, message, status, preflight);
  } else if (/^status\s*:\s*200\b/.test(normalized) && !/cors|blocked|error|fail/.test(normalized)) {
    diagnosis = {
      ...browserDiagnosis('success', 'Successful HTTP response', 'client',
        'The pasted result reports HTTP 200, which alone does not prove JavaScript could read the response.',
        ['Compare with the controlled test', 'Confirm JavaScript could read the response'], 'UNKNOWN'),
      mainRequest: 'YES'
    };
  } else {
    diagnosis = {
      family: 'unknown', side: null,
      title: normalized ? 'Result not recognized yet' : 'Paste a browser result first',
      explanation: 'There is not enough evidence to identify the cause or choose a client, server, or network fix.',
      summary: 'The message does not establish whether a preflight occurred.',
      preflight: 'UNKNOWN', mainRequest: 'UNKNOWN',
      likelyCause: 'Unknown; keep the original browser message rather than guessing.',
      checks: ['Copy the complete Console message for the failing request', 'Inspect the matching request in the Network tab']
    };
  }
  if (/\bmode(?:\s+to|\s*[:=])\s*['"\x60]?no-cors\b/.test(normalized)) {
    diagnosis.explanation += ' Avoid no-cors when your code needs to read the response. It makes the response opaque to JavaScript.';
  }
  return diagnosis;
}

// Extract only explicitly identified request context. Never infer an origin from
// an allowed-origin header, and suppress context when multiple requests differ.
function extractBrowserContext(text) {
  const origins = new Set(), targets = new Set(), redirectSources = new Set();
  let invalid = false;
  function add(set, value, originOnly = false) {
    try {
      if (!/^https?:\/\/[^\s]+$/i.test(value)) throw new Error();
      const url = new URL(value);
      if (url.username || url.password || (originOnly && value !== url.origin && value !== url.origin + '/')) throw new Error();
      set.add(originOnly ? url.origin : value);
    } catch { invalid = true; }
  }
  for (const match of String(text || '').matchAll(/Access to (?:fetch|XMLHttpRequest) at ['“‘]([^'”’]+)['”’](?: \(redirected from ['“‘]([^'”’]+)['”’]\))? from origin ['“‘]([^'”’]+)['”’]/g)) {
    add(targets, match[1]);
    if (match[2]) add(redirectSources, match[2]);
    add(origins, match[3], true);
  }
  for (const match of String(text || '').matchAll(/Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at (https?:\/\/[^\s]+)\. \(Reason:/g)) {
    add(targets, match[1]);
  }
  if (invalid || origins.size > 1 || targets.size > 1 || redirectSources.size > 1) return {};
  return {origin: [...origins][0], target: [...targets][0], redirectedFrom: [...redirectSources][0]};
}
