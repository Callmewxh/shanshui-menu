// 端到端验证：点菜界面右键套餐 chip → 菜单可见 → 点「定制菜单」→ 菜单关闭且进入定制单模式。
const WebSocket = global.WebSocket;
const http = require('http');
const PORT = 9222;
const TARGET_URL = 'http://127.0.0.1:8123/index.html';
function getJSON(u){return new Promise((res,rej)=>{http.get(u,(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d));}catch(e){rej(e);}});}).on('error',rej);});}
function connect(u){return new Promise((resolve,rej)=>{const ws=new WebSocket(u);ws._pending=new Map();ws.onmessage=(ev)=>{let m;try{m=JSON.parse(ev.data);}catch{return;}if(m.id&&ws._pending.has(m.id)){const p=ws._pending.get(m.id);ws._pending.delete(m.id);m.error?p.reject(new Error(m.error.message||JSON.stringify(m.error))):p.resolve(m.result);}};ws.onopen=()=>resolve(ws);ws.onerror=(e)=>rej(e.error||new Error('ws'));});}
let _id=0;function send(ws,m,p={}){return new Promise((resolve,reject)=>{const id=++_id;ws._pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method:m,params:p}));});}
function evaluate(ws,e){return send(ws,'Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}).then(r=>{if(r.exceptionDetails)return{__err:r.exceptionDetails.text};return r.result?r.result.value:undefined;});}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
(async()=>{
  const list=await getJSON(`http://127.0.0.1:${PORT}/json`);
  const page=list.find(t=>t.type==='page'&&/about:blank/.test(t.url))||list.find(t=>t.type==='page')||list[0];
  const ws=await connect(page.webSocketDebuggerUrl);
  await send(ws,'Runtime.enable');await send(ws,'Page.enable');await send(ws,'Page.navigate',{url:TARGET_URL});
  let ready=false;
  for(let i=0;i<40;i++){await sleep(500);const st=await evaluate(ws,`(()=>({chip:!!document.querySelector('#pkgbar .chip')}))()`);if(st&&st.chip){ready=true;break;}}
  if(!ready){console.log('!! 初始化失败');process.exit(1);}
  const r=await evaluate(ws,`(()=>{
    const chip=document.querySelector('#pkgbar .chip');
    chip.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:200,clientY:200}));
    const m=document.getElementById('pkgbarCtxMenu');
    const rc=m.getBoundingClientRect();
    const visible = (rc.width>0&&rc.height>0&&rc.x>=0&&rc.y>=0&&rc.right<=innerWidth&&rc.bottom<=innerHeight);
    const item=m.querySelector('.ctx-item[data-act="custom"]');
    item.click(); // 模拟点「定制菜单」
    const afterHidden=m.hidden;
    const customShown=!document.getElementById('customScreen').hidden;
    const mode=document.body.getAttribute('data-mode')||(window.state&&window.state.mode)||'n/a';
    return { menuVisible:visible, rectW:Math.round(rc.width), rectH:Math.round(rc.height), afterClickMenuHidden:afterHidden, customScreenShown:customShown, mode };
  })()`);
  console.log('=== 端到端 ===');
  console.log(JSON.stringify(r,null,2));
  process.exit(0);
})().catch(e=>{console.error('脚本错误:',e);process.exit(1);});
