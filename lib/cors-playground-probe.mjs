import { methods, supportsProbe } from "../public/cors-playground-core.mjs";

const headerName = /^[!#$%&'*+.^_|~0-9a-z-]{1,64}$/;
const responseHeaders = [
  "access-control-allow-origin", "access-control-allow-credentials", "access-control-allow-methods",
  "access-control-allow-headers", "access-control-max-age", "location", "vary",
];

function validProbe(input) {
  if (!input || typeof input.url !== "string" || input.url.length > 1000 ||
      typeof input.origin !== "string" || input.origin.length > 300 || !methods.includes(input.method) ||
      !Array.isArray(input.names) || input.names.length > 30 ||
      !input.names.every(name => typeof name === "string" && headerName.test(name))) return false;
  try {
    const url = new URL(input.url);
    const origin = new URL(input.origin);
    return !url.username && !url.password && !url.hash && supportsProbe(url) &&
      ["http:", "https:"].includes(origin.protocol) && origin.origin === input.origin;
  } catch { return false; }
}

export async function runPreflightProbe(input, fetchUpstream = fetch) {
  if (!validProbe(input)) {
    return { status: 400, body: { error: "Automatic probes are limited to AnotherExample’s test endpoints." } };
  }
  const headers = { Origin: input.origin, "Access-Control-Request-Method": input.method };
  if (input.names.length) headers["Access-Control-Request-Headers"] = input.names.join(", ");
  try {
    const response = await fetchUpstream(input.url, {
      method: "OPTIONS", headers, redirect: "manual", signal: AbortSignal.timeout(6500),
    });
    const details = Object.fromEntries(responseHeaders.filter(name => response.headers.has(name))
      .map(name => [name, response.headers.get(name)]));
    return { status: 200, body: { status: response.status, headers: details, source: "Separate OPTIONS probe" } };
  } catch {
    return { status: 502, body: { error: "The separate OPTIONS probe could not reach the test endpoint." } };
  }
}
