// 定位机制：打开菜单后，分别 (a) 改 .app overflow=visible (b) 把菜单移到 body，测 offsetWidth，看哪个让 0×0 恢复 136。
const WebSocket = global.WebSocket;
const http = require('http');
const PORT = 9222;
const TARGET_URL = 'http://127.0.0.1:8123/index.html';
function getJSON(url){return new Promise((res,rej)=>{http.get(url,(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d));}catch(e){rej(e);}});}).on('error',rej);});}
function connect(u){return new Promise((resolve,reject)=>{const ws=new WebSocket(u);ws._pending=new Map();ws.onmessage=(ev)=>{let m;try{m=JSON.parse(ev.data);}catch{return;}if(m.id&&ws._pending.has(m.id)){const p=ws._pending.get(m.id);ws._pending.delete(m.id);m.error?p.reject(new Error(m.error.message||JSON.stringify(m.error))):p.resolve(m.result);}};ws.onopen=()=>resolve(ws);ws.onerror=(e)=>reject(e.error||new Error('ws'));});}
let _id=0;function send(ws,method,params={}){return new Promise((resolve,reject)=>{const id=++_id;ws._pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
function evaluate(ws,expr){return send(ws,'Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true}).then(r=>{if(r.exceptionDetails)return{__err:r.exceptionDetails.text};return r.result?r.result.value:undefined;});}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
(async()=>{
  const list=await getJSON(`http://127.0.0.1:${PORT}/json`);
  const page=list.find(t=>t.type==='page'&&/about:blank/.test(t.url))||list.find(t=>t.type==='page')||list[0];
  const ws=await connect(page.webSocketDebuggerUrl);
  await send(ws,'Runtime.enable');await send(ws,'Page.enable');await send(ws,'Page.navigate',{url:TARGET_URL});
  let ready=false;
  for(let i=0;i<40;i++){await sleep(500);const st=await evaluate(ws,`(()=>({chip:!!document.querySelector('#pkgbar .chip')}))()`);if(st&&st.chip){ready=true;break;}}
  if(!ready){console.log('!! 初始化失败');process.exit(1);}
  const out=await evaluate(ws,`(()=>{
    const chip=document.querySelector('#pkgbar .chip');
    chip.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:120,clientY:120}));
    const m=document.getElementById('pkgbarCtxMenu');
    const app=document.querySelector('.app');
    const r={};
    r.baseline=app?app.style.overflow:'noApp';
    r.owBase=m.offsetWidth;
    // (a) .app overflow -> visible
    if(app) app.style.overflow='visible';
    r.owOverflowVisible=m.offsetWidth;
    r.appDisplay=getComputedStyle(app).display;
    r.appPosition=getComputedStyle(app).position;
    // (b) 移到 body
    document.body.appendChild(m);
    r.owMovedToBody=m.offsetWidth;
    r.mOffsetParent=m.offsetParent?m.offsetParent.className||m.offsetParent.tagName:'null';
    return r;
  })()`);
  console.log(JSON.stringify(out,null,2));
  process.exit(0);
})().catch(e=>{console.error('脚本错误:',e);process.exit(1);});
