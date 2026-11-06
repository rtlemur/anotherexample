
const scenarios=[
  {name:'✓ Basic success',desc:'Request should succeed',v:{method:'GET',allowOrigin:'*',methods:'GET, POST, OPTIONS',headers:'Content-Type',credentials:false,preflight:'204'}},
  {name:'✕ Missing allow-origin',desc:'Browser should block it',v:{method:'GET',allowOrigin:'none',credentials:false,preflight:'204'}},
  {name:'✕ Wrong origin',desc:'Browser should block it',v:{method:'GET',allowOrigin:'https://wrong.example',credentials:false,preflight:'204'}},
  {name:'✓ Preflight allowed',desc:'Preflight should succeed',v:{method:'POST',allowOrigin:'*',methods:'GET, POST, OPTIONS',headers:'Content-Type',credentials:false,preflight:'204'}},
  {name:'✕ Preflight rejected',desc:'OPTIONS returns 403',v:{method:'POST',allowOrigin:'*',credentials:false,preflight:'403'}},
  {name:'✕ Credentials + wildcard',desc:'Browser should block it',v:{method:'GET',allowOrigin:'*',credentials:true,preflight:'204'}},
  {name:'✓ Reflected origin + credentials',desc:'Caller origin is reflected; request should succeed',v:{method:'GET',allowOrigin:'echo',credentials:true,preflight:'204'}}
];

const $=id=>document.getElementById(id);
let settings;
const LAB_ORIGIN=location.hostname==='anotherexample.com'||location.hostname==='www.anotherexample.com'
  ? 'https://cors.anotherexample.com'
  : 'https://cors-preview.anotherexample.com';

function params(){return new URLSearchParams({allowOrigin:settings.allowOrigin,credentials:String(settings.credentials),methods:settings.methods,headers:settings.headers,preflightStatus:settings.preflight,delay:settings.delay||'0'});}
function url(){return LAB_ORIGIN+'/api/cors/lab?'+params();}
function fetchText(){
  const u=url(), method=settings.method, opts=[];
  if(method!=='GET') opts.push(`method: '${method}'`, "headers: { 'Content-Type': 'application/json' }", "body: JSON.stringify({ playground: 'test' })");
  if(settings.credentials) opts.push("credentials: 'include'");
  return `fetch('${u}'${opts.length?`, {\n  ${opts.join(',\n  ')}\n}`:''})\n  .then(r => r.json())\n  .then(console.log)\n  .catch(console.error);`;
}
function explain(){
  let msg,cls='ok';const a=settings.allowOrigin,c=settings.credentials,p=settings.preflight,m=settings.method;
  if(a==='none'){msg='Blocked: the response has no Access-Control-Allow-Origin header.';cls='bad'}
  else if(a==='https://wrong.example'){msg='Blocked: the allowed origin does not match the requesting page.';cls='bad'}
  else if(c&&a==='*'){msg='Blocked: credentialed CORS cannot use Access-Control-Allow-Origin: *.';cls='bad'}
  else if(m!=='GET'&&p!=='204'){msg='Blocked before the main request: the preflight is rejected.';cls='bad'}
  else if(c&&a==='echo'){msg='Should succeed here: the caller Origin is reflected and credentials are allowed. In production, only reflect origins you trust.'}
  else{msg='Should succeed for a cross-origin request that matches these settings.'}
  $('expected').className='status '+cls;$('expected').textContent=msg;highlightCode($('fetchCode'), fetchText());
  const labels=cls==='bad' ? (m!=='GET'&&p!=='204' ? ['403 Forbidden','Preflight failed'] : ['CORS blocked']) : (m!=='GET' ? ['204 No Content','200 OK'] : ['200 OK']);
  const badges=document.createElement('div');
  labels.forEach(label=>badges.append(resultBadge(label,cls)));
  $('expected').prepend(badges);
}


const box=$('scenarios');
scenarios.forEach((scenario,index)=>{
  const button=document.createElement('button');
  button.className='scenario';
  button.setAttribute('aria-pressed','false');
  button.innerHTML=`<strong>${scenario.name}</strong><span>${scenario.desc}</span>`;
  button.onclick=()=>{
    settings={methods:'GET, POST, OPTIONS',headers:'Content-Type',delay:'0',...scenario.v};
    [...box.children].forEach(child=>child.setAttribute('aria-pressed',String(child===button)));
    $('scenarioState').textContent='Scenario: '+scenario.name.replace(/^[✓✕]\s*/,'');
    explain();
  };
  box.append(button);
  if(index===0) button.click();
});
copyControl('copyFetch',fetchText);
copyControl('copyUrl',url);
