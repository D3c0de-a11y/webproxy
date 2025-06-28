import express from 'express';
import rateLimit from 'express-rate-limit';
import cheerio from 'cheerio';
import { ProxyAgent, fetch } from 'undici';

const PORT = process.env.PORT || 3000;
const proxyAgent = process.env.https_proxy ? new ProxyAgent(process.env.https_proxy) : undefined;

const app = express();

const limiter = rateLimit({ windowMs: 60_000, max: 30 });
app.use(limiter);

// redirect / to QuickBooks via proxy
app.get('/', (req, res) => {
  const target = 'https://quickbooks.intuit.com/';
  res.redirect(302, `/proxy?url=${encodeURIComponent(target)}`);
});

// helper to ensure url is within intuit domains
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
  const $ = cheerio.load(html);
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

app.get('/proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing url param');
  const url = validateUrl(target);
  if (!url) return res.status(403).send('Forbidden');

  const headers = {
    'user-agent': req.headers['user-agent'] || '',
    'accept-language': req.headers['accept-language'] || '',
    cookie: req.headers['cookie'] || '',
  };

  try {
    const response = await fetch(url.toString(), {
      headers,
      redirect: 'manual',
      dispatcher: proxyAgent,
    });

    res.status(response.status);
    res.set('X-Frame-Options', 'SAMEORIGIN');

    const setCookie = response.headers.raw()['set-cookie'];
    if (setCookie) res.set('Set-Cookie', setCookie);
    const ctype = response.headers.get('content-type');
    if (ctype) res.set('Content-Type', ctype);
    const clen = response.headers.get('content-length');
    if (clen) res.set('Content-Length', clen);

    if (ctype && ctype.includes('text/html')) {
      const text = await response.text();
      res.send(rewriteHtml(text, url.toString()));
    } else {
      for await (const chunk of response.body) res.write(chunk);
      res.end();
    }
  } catch {
    res.status(502).send('Bad Gateway');
  }
});

app.listen(PORT, () => console.log(`proxy on :${PORT}`));
