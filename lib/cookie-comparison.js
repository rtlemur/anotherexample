const defaults = require('../public/cookie-comparison-config.json');
const COOKIE_NAME = 'anotherexample_cookie_comparison';
const COOKIE_VALUE = 'demo';
const CHECK_PATH = '/api/cookie-comparison/check';
const SETUP_PATH = '/api/cookie-comparison/setup';

function mountCookieComparison(app, {
  primary = defaults.primary,
  secondary = defaults.secondary,
} = {}) {
  // These origins come from deployment configuration, never a request header.
  const config = { primary: new URL(primary).origin, secondary: new URL(secondary).origin };
  if (config.primary === config.secondary) throw new Error('Cookie comparison requires distinct origins.');

  app.get('/cookie-comparison-config.json', (req, res) => {
    res.set('Cache-Control', 'no-store').json(config);
  });

  app.post(SETUP_PATH, (req, res) => {
    if (req.get('Origin') !== config.primary) {
      return res.status(403).json({ error: 'Open the main comparison page to set the demo cookie.' });
    }

    res.cookie(COOKIE_NAME, COOKIE_VALUE, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: CHECK_PATH,
      maxAge: 10 * 60 * 1000,
    });
    res.status(204).end();
  });

  app.get(CHECK_PATH, (req, res) => {
    const origin = req.get('Origin');
    res.vary('Origin');

    if (origin && origin !== config.primary && origin !== config.secondary) {
      return res.status(403).json({ error: 'This origin is outside the cookie comparison.' });
    }
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Credentials', 'true');
    }

    const cookies = req.get('Cookie') || '';
    const received = cookies.split(';').some(cookie => cookie.trim() === COOKIE_NAME + '=' + COOKIE_VALUE);
    res.json({ received });
  });
}

module.exports = mountCookieComparison;
