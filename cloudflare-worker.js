// ──────────────────────────────────────────────────────────────────────
// FormatGPT — DAM proxy (Cloudflare Worker)
// ──────────────────────────────────────────────────────────────────────
// Why this exists:
//   digitalaccountmarket.com sits behind Cloudflare. Public CORS proxies
//   either get HTTP 5xx, rate-limited, or receive Cloudflare challenge
//   HTML instead of JSON. A Cloudflare Worker you control bypasses this
//   because CF tends not to challenge its own workers, and even if it
//   does you can set the headers yourself.
//
// Deploy in ~90 seconds (free plan covers this easily):
//   1. https://dash.cloudflare.com/ → Workers & Pages → Create → Worker
//   2. Paste this entire file into the editor, click "Save and deploy"
//   3. Copy the worker URL (e.g. https://dam-proxy.yourname.workers.dev)
//   4. In FormatGPT's DAM panel, paste this into "Custom Proxy URL":
//        https://dam-proxy.yourname.workers.dev/?url=
//      (trailing ?url= matters — the target URL gets appended)
//
// That's it. No more "all proxies blocked".
//
// Optional: lock the worker to only proxy digitalaccountmarket.com so
// it can't be abused by strangers. Flip ALLOW_ONLY_DAM to true below.
// ──────────────────────────────────────────────────────────────────────

const ALLOW_ONLY_DAM = false; // set to true to restrict to digitalaccountmarket.com

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Accept-Language",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const u = new URL(request.url);
    const target = u.searchParams.get("url");
    if (!target) {
      return new Response("usage: ?url=https://…", { status: 400, headers: cors });
    }

    let parsed;
    try { parsed = new URL(target); }
    catch { return new Response("bad url", { status: 400, headers: cors }); }

    if (ALLOW_ONLY_DAM && !/(^|\.)digitalaccountmarket\.com$/i.test(parsed.hostname)) {
      return new Response("host not allowed", { status: 403, headers: cors });
    }

    // Forward with browser-like headers so CF's bot checker is satisfied.
    const upstream = await fetch(parsed.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain;q=0.9, */*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; FormatGPT-DAM/1.0)",
        "Referer": parsed.origin + "/en",
      },
      cf: { cacheTtl: 60, cacheEverything: true }, // small edge cache to be polite
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...cors,
        "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  },
};
