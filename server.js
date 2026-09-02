// anotherexample.com — a permanent second origin for browser and integration testing.
const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

const contactLimiter = rateLimit({windowMs: 15 * 60 * 1000,limit: 5,standardHeaders: true,legacyHeaders: false});

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_DELAY_MS = 10000;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb', strict: false }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please wait a minute and try again.' },
  skip: req => req.path === '/health',
});
const slowLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Delay endpoint rate limit exceeded. Please wait a minute and try again.' },
});
app.use('/api', apiLimiter);
app.use('/api/delay', slowLimiter);

function noStore(res) { res.set('Cache-Control', 'no-store'); }
function publicHeaders(req) {
  const hiddenExact = new Set(['authorization','proxy-authorization','cookie','forwarded','x-real-ip','x-invocation-id']);
  const hiddenPrefixes = ['x-vercel-','x-forwarded-','x-middleware-'];
  return Object.fromEntries(Object.entries(req.headers).filter(([name]) => {
    const lower = name.toLowerCase();
    return !hiddenExact.has(lower) && !hiddenPrefixes.some(prefix => lower.startsWith(prefix));
  }));
}
function requestSnapshot(req) {
  return { method:req.method, path:req.originalUrl, query:req.query, headers:publicHeaders(req), body:req.body ?? null,
    timestamp:new Date().toISOString(), note:'Sensitive, hosting-provider, and client IP information are omitted.' };
}
function hasTestCookie(req) {
  const raw=req.get('Cookie')||'';
  return raw.split(';').some(part=>part.trim().startsWith('anotherexample_test='));
}
function setOpenCors(req,res) {
  res.set({'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':req.get('Access-Control-Request-Headers')||'Content-Type, Authorization','Access-Control-Max-Age':'600'});
}
app.post('/api/contact', contactLimiter, (req, res) => {
  const { name = '', email = '', message = '', website = '' } = req.body || {};

  // Honeypot: bots often fill this hidden field.
  if (website) {
    return res.status(200).json({ sent: true });
  }

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim();
  const cleanMessage = String(message).trim();

  if (
    cleanName.length > 100 ||
    cleanEmail.length > 254 ||
    cleanMessage.length < 1 ||
    cleanMessage.length > 5000
  ) {
    return res.status(400).json({
      error: 'Invalid contact form submission.'
    });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(cleanEmail)) {
    return res.status(400).json({
      error: 'Please enter a valid email address.'
    });
  }

  return res.status(200).json({
    sent: true
  });
});

app.use('/api/cors/open',(req,res,next)=>{setOpenCors(req,res);if(req.method==='OPTIONS')return res.sendStatus(204);next();});
app.all('/api/cors/open',(req,res)=>{noStore(res);res.json({mode:'open',message:'Permissive CORS response using Access-Control-Allow-Origin: *.',...requestSnapshot(req)});});

app.use('/api/cors/credentials',(req,res,next)=>{
  const origin=req.get('Origin'); if(origin){res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');}
  res.set({'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':req.get('Access-Control-Request-Headers')||'Content-Type, Authorization','Access-Control-Max-Age':'600'});
  if(req.method==='OPTIONS')return res.sendStatus(204); next();
});
app.all('/api/cors/credentials',(req,res)=>{noStore(res);res.json({mode:'credentials',message:'Credentialed CORS response. The request Origin is reflected when present.',...requestSnapshot(req)});});

// Configurable CORS laboratory endpoint. Query parameters deliberately control response behavior.
app.all('/api/cors/lab', async (req,res)=>{
  const q=req.query;
  const delay=Math.min(Math.max(Number(q.delay)||0,0),3000);
  if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
  const origin=req.get('Origin');
  const allowOrigin=String(q.allowOrigin||'*');
  if(allowOrigin !== 'none') {
    const value=allowOrigin==='echo' ? origin : allowOrigin;
    if(value) res.set('Access-Control-Allow-Origin',value);
  }
  if(q.credentials==='true') res.set('Access-Control-Allow-Credentials','true');
  if(q.methods !== 'none') res.set('Access-Control-Allow-Methods',String(q.methods||'GET, POST, OPTIONS'));
  if(q.headers !== 'none') res.set('Access-Control-Allow-Headers',String(q.headers||req.get('Access-Control-Request-Headers')||'Content-Type'));
  if(q.expose) res.set('Access-Control-Expose-Headers',String(q.expose));
  if(q.maxAge) res.set('Access-Control-Max-Age',String(q.maxAge));
  res.set('Vary','Origin'); noStore(res);
  if(req.method==='OPTIONS') {
    const preflight=Number(q.preflightStatus||204);
    return res.status(Number.isInteger(preflight)&&preflight>=200&&preflight<=599?preflight:204).end();
  }
  const status=Number(q.status||200);
  const safeStatus=Number.isInteger(status)&&status>=200&&status<=599?status:200;
  if(safeStatus===204||safeStatus===304) return res.status(safeStatus).end();
  res.status(safeStatus).json({mode:'lab',configuration:{allowOrigin,credentials:q.credentials==='true',methods:q.methods||'GET, POST, OPTIONS',headers:q.headers||'Content-Type',delay},...requestSnapshot(req)});
});

app.use('/api/cors',(req,res,next)=>{if(req.path!=='/')return next();setOpenCors(req,res);if(req.method==='OPTIONS')return res.sendStatus(204);next();});
app.all('/api/cors',(req,res)=>{noStore(res);res.json({message:'Permissive CORS response. See /api/cors/open, /api/cors/credentials, and /api/cors/lab.',...requestSnapshot(req)});});
app.all('/api/echo',(req,res)=>{noStore(res);res.json(requestSnapshot(req));});
app.all('/api/status/:code',(req,res)=>{const code=Number(req.params.code);if(!Number.isInteger(code)||code<200||code>599)return res.status(400).json({error:'Status code must be an integer from 200 to 599.'});noStore(res);if(code===204||code===304)return res.status(code).end();res.status(code).json({status:code,message:`Intentional test response with HTTP ${code}.`});});
app.all('/api/delay/:ms',async(req,res)=>{const ms=Number(req.params.ms);if(!Number.isInteger(ms)||ms<0||ms>MAX_DELAY_MS)return res.status(400).json({error:`Delay must be an integer from 0 to ${MAX_DELAY_MS} milliseconds.`});await new Promise(resolve=>setTimeout(resolve,ms));noStore(res);res.json({delayed:ms,unit:'milliseconds'});});
app.get('/api/redirect',(req,res)=>{const status=Number(req.query.status||302),target=req.query.target||'health';const targets={health:'/api/health',home:'/',example:'https://example.com/'};if(![301,302,303,307,308].includes(status))return res.status(400).json({error:'status must be one of 301, 302, 303, 307, or 308.'});if(!targets[target])return res.status(400).json({error:'target must be health, home, or example.'});noStore(res);res.redirect(status,targets[target]);});
app.get('/api/cookie/set',(req,res)=>{const input=String(req.query.sameSite||'Lax').toLowerCase(),map={lax:'Lax',strict:'Strict',none:'None'},sameSite=map[input];if(!sameSite)return res.status(400).json({error:'sameSite must be Lax, Strict, or None.'});res.cookie('anotherexample_test','present',{httpOnly:false,secure:sameSite==='None',sameSite,maxAge:3600000});noStore(res);res.json({set:true,cookie:'anotherexample_test',sameSite,secure:sameSite==='None'});});
app.get('/api/cookie/check',(req,res)=>{noStore(res);res.json({cookie:'anotherexample_test',received:hasTestCookie(req)});});
app.get('/api/cookie/clear',(req,res)=>{res.clearCookie('anotherexample_test');noStore(res);res.json({cleared:true,cookie:'anotherexample_test'});});
app.get('/api/health',(req,res)=>{noStore(res);res.json({status:'ok',domain:'anotherexample.com'});});

app.get('/cors',(req,res)=>res.sendFile(path.join(__dirname,'public','cors.html')));
app.get('/contact',(req,res)=>res.sendFile(path.join(__dirname,'public','contact.html')));
app.get('/.well-known/security.txt',(req,res)=>res.type('text/plain').sendFile(path.join(__dirname,'public','.well-known','security.txt'),{dotfiles:'allow'}));
app.get('/security.txt',(req,res)=>res.redirect(302,'/.well-known/security.txt'));
app.use(express.static(path.join(__dirname,'public'),{maxAge:'1h'}));

app.use((err,req,res,next)=>{if(err&&err.type==='entity.too.large')return res.status(413).json({error:'Request body too large. Maximum body size is 64 KB.'});if(err instanceof SyntaxError&&err.status===400&&'body'in err)return res.status(400).json({error:'Invalid JSON body.'});next(err);});
if(require.main===module)app.listen(PORT,()=>console.log(`anotherexample.com running on http://localhost:${PORT}`));
module.exports=app;
