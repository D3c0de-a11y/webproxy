import express from 'express';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { load } from 'cheerio';

const PORT = process.env.PORT || 3000;
const app = express();

const limiter = rateLimit({ windowMs: 60_000, max: 30 });
app.use(limiter);

// redirect / to QuickBooks via proxy
app.get('/', (req, res) => {
  const target = 'https://quickbooks.intuit.com/';
  res.redirect(302, `/proxy?url=${encodeURIComponent(target)}`);
});

function validateUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    if (host === 'intuit.com' || host.endsWith('.intuit.com')) return url;
  } catch {}
  return null;
}

function proxify(original, base) {
  try {
    const abs = new URL(original, base).toString();
    return '/proxy?url=' + encodeURIComponent(abs);
  } catch {
    return original;
  }
}

function rewriteHtml(html, base) {
  const $ = load(html);
  const attrs = [
    ['a', 'href'],
    ['form', 'action'],
    ['script', 'src'],
    ['link', 'href'],
  ];
  for (const [tag, attr] of attrs) {
    $(tag).each((_, el) => {
      const val = $(el).attr(attr);
      if (val) $(el).attr(attr, proxify(val, base));
    });
  }
  $('script').each((_, el) => {
    const code = $(el).html();
    if (!code) return;
    let replaced = code.replace(/fetch\(['"](https?:[^'"]+)['"]/g, (_, u) => `fetch('${proxify(u, base)}'`);
    replaced = replaced.replace(/open\(['"]\w+['"],\s*['"](https?:[^'"]+)['"]/g, (m, u) => m.replace(u, proxify(u, base)));
    if (replaced !== code) $(el).text(replaced);
  });
  return $.html();
}

app.use('/proxy', (req, res, next) => {
  const url = validateUrl(req.query.url);
  if (!url) return res.status(403).send('Forbidden');
  req.targetUrl = url;
  next();
}, createProxyMiddleware({
  changeOrigin: true,
  selfHandleResponse: true,
  router: req => req.targetUrl.origin,
  pathRewrite: (path, req) => req.targetUrl.pathname + req.targetUrl.search + req.targetUrl.hash,
  onProxyReq: (proxyReq, req) => {
    const headers = ['user-agent', 'accept-language', 'cookie'];
    for (const h of headers) {
      const val = req.headers[h];
      if (val) proxyReq.setHeader(h, val);
    }
  },
  onProxyRes: responseInterceptor(async (buffer, proxyRes, req, res) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    const type = proxyRes.headers['content-type'] || '';
    if (type.includes('text/html')) {
      res.removeHeader('content-length');
      return rewriteHtml(buffer.toString('utf8'), req.targetUrl.toString());
    }
    return buffer;
  })
}));

app.listen(PORT, () => console.log(`proxy on :${PORT}`));
