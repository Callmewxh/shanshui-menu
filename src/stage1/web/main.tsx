import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { amountMinor } from './domain';
import './style.css';
type Snapshot = { restricted: boolean; amount: number; revision: number; rows: number; dishes: string[]; reference?: number; events?: number; request?: string };
type FileResult = { files: string[]; pages: number; peakBitmapBytes: number; pdfPages: number };
interface Bridge {
  read(): Promise<Snapshot>;
  write(options: { amount: number; rows: number; fail: boolean }): Promise<Snapshot>;
  restrict(): Promise<Snapshot>;
  recover(options: { method: string }): Promise<Snapshot>;
  checks(): Promise<Record<string, unknown>>;
  exportMenu(options: { template: string }): Promise<FileResult>;
  openFile(options: { name: string }): Promise<void>;
  saveFile(options: { name: string }): Promise<void>;
}
const Native = registerPlugin<Bridge>('StageOne');
interface StageTwoBridge { read(): Promise<Record<string, unknown>>; scenario(options:{fail:boolean}): Promise<Record<string, unknown>>; undo(): Promise<Record<string, unknown>>; health(): Promise<Record<string, unknown>>; reset(): Promise<Record<string, unknown>>; }
const StageTwo = registerPlugin<StageTwoBridge>('StageTwo');
function App() {
  const [state, setState] = useState<Snapshot>();
  const [status, setStatus] = useState('正在读取原生事务数据库');
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState('2999');
  const [rows, setRows] = useState(16);
  const [files, setFiles] = useState<string[]>([]);
  const gesture = useRef({ at: 0, x: 0 });
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try { const value = await action(); setStatus(JSON.stringify(value, null, 2)); }
    catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) { setStatus('需要 Android APK。浏览器不提供模拟存储成功结果。'); return; }
    void Native.read().then(s => { setState(s); setPrice(String(s.amount/100)); setRows(s.rows); setStatus('已恢复'); }).catch(e => setStatus(String(e)));
  }, []);
  if (!state) return <main><h1>山水技术验证</h1><p role="status">{status}</p></main>;
  if (state.restricted) return <main><h1>宴席菜单</h1><p>当前对客报价 ¥{state.amount/100}/桌 · {state.rows} 道</p>
    <p>客户受限展示测试：返回键应留在这里，重启也应先恢复此范围。</p>
    <button disabled={busy} onPointerDown={e => { gesture.current = { at: performance.now(), x: e.clientX }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerUp={e => { if (performance.now()-gesture.current.at >= 1000 && e.clientX-gesture.current.x >= 80) void run(async () => { setState(await Native.recover({method:'session'})); return '恢复销售工作态'; }); }}>
      销售取回：按住 1 秒向右滑动</button>
    <button disabled={busy} onClick={() => void run(async () => { setState(await Native.recover({method:'credential'})); return '设备验证完成'; })}>设备凭证恢复（冷启动）</button>
    <p role="status">{busy ? '处理中' : status}</p><ul>{state.dishes.map(d=><li key={d}>{d}</li>)}</ul></main>;
  return <main><h1>阶段 1 · Android 技术验证</h1><p>合成数据，独立数据库；这不是正式业务页面。</p>
    <p>版本 {state.revision} · 原生事件 {state.events} · 自动询价号 {state.request}</p>
    <label>当前对客报价（元/桌）<input value={price} onChange={e=>setPrice(e.target.value)} inputMode="decimal" /></label>
    <label>样例菜数<select value={rows} onChange={e=>setRows(Number(e.target.value))}>{[1,16,40,100].map(n=><option key={n}>{n}</option>)}</select></label>
    <button disabled={busy} onClick={()=>void run(async()=>{const s=await Native.write({amount:amountMinor(price),rows,fail:false});setState(s);return '事务已提交，可立即杀进程验证';})}>提交原生事务</button>
    <button disabled={busy} onClick={()=>void run(()=>Native.write({amount:100,rows:100,fail:true}))}>注入写入中断（应回滚）</button>
    <button disabled={busy} onClick={()=>void run(()=>Native.checks())}>运行原生存储/字体检查</button>
    <button disabled={busy} onClick={()=>void run(async()=>{const s=await Native.read();setState(s);return s;})}>重新读取已提交状态</button>
    <section aria-label="阶段2.5原生数据验证"><h2>阶段 2.5 · SQLite 数据验证</h2><p>合成数据；创建匿名洽谈、A→B→C、临时菜、报价和 V1 冻结。</p>
      <button disabled={busy} onClick={()=>void run(()=>StageTwo.scenario({fail:false}))}>提交完整业务事务</button>
      <button disabled={busy} onClick={()=>void run(()=>StageTwo.scenario({fail:true}))}>注入阶段 2.5 事务故障</button>
      <button disabled={busy} onClick={()=>void run(()=>StageTwo.read())}>读取杀进程恢复状态</button>
      <button disabled={busy} onClick={()=>void run(()=>StageTwo.undo())}>重启后 Undo（C → B）</button>
      <button disabled={busy} onClick={()=>void run(()=>StageTwo.health())}>SQLite 健康/Schema 检查</button>
      <button disabled={busy} onClick={()=>void run(()=>StageTwo.reset())}>清空合成阶段 2.5 数据</button></section>
    <button disabled={busy} onClick={()=>void run(async()=>{setFiles([]);setStatus('');setState(await Native.restrict());return '仅客户白名单';})}>交给客户浏览</button>
    <section aria-label="基础导出">{[['kitchen','厨房版'],['receipt','客户无图小票'],['photo','客户有图']].map(([id,title])=><button key={id} disabled={busy} onClick={()=>void run(async()=>{const result=await Native.exportMenu({template:id});setFiles(result.files);return result;})}>生成 {title} PNG/PDF</button>)}</section>
    <ul>{files.map(name=><li key={name}>{name}<button disabled={busy} onClick={()=>void run(()=>Native.openFile({name}))}>重新打开</button><button disabled={busy} onClick={()=>void run(()=>Native.saveFile({name}))}>另存到系统文件</button></li>)}</ul>
    <pre role="status">{busy ? '原生操作进行中…' : status}</pre>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
