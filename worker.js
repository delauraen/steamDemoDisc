// Demo Disc — Cloudflare Worker proxy
// Deploy this to Cloudflare Workers (free tier) to reliably forward
// Steam API requests from the browser without CORS errors.
//
// Usage: https://your-worker.workers.dev/?url=<encoded-steam-url>

export default {
  async fetch(request) {

    // Handle CORS preflight (browser sends this before the real request)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get('url');

    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400 });
    }

    // Safety: only proxy Steam domains so the worker can't be abused
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }

    const allowed = ['.steampowered.com', '.steamstatic.com'];
    if (!allowed.some(d => targetUrl.hostname.endsWith(d))) {
      return new Response('Only Steam URLs are allowed', { status: 403 });
    }

    try {
      const upstream = await fetch(target, {
        headers: {
          // Pretend to be a regular browser so Steam doesn't reject the request
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      const body = await upstream.text();

      return new Response(body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
