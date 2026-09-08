import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pricingContent, amountMinor, type Menu } from '../web/domain.ts';
const base: Menu = { lines: [{id:'a',name:'石斛炖老鸡汤',quantity:1,preparation:'原做法',position:0},{id:'b',name:'清蒸鲜鱼',quantity:1,preparation:'清蒸',position:1}] };
test('宴会/客户/跟进/展示排序与图片不会使报价失效',()=>{
  const changed = structuredClone(base); Object.assign(changed,{tableCount:99,date:'2027-01-01',customer:'更正称呼',followUp:'备注'});
  changed.lines.reverse(); changed.lines[0].image='new.jpg';changed.lines[0].position=100;
  assert.equal(pricingContent(base), pricingContent(changed));
});
test('换菜/新增/删除/份量/核价做法必须改变指纹输入，Undo 恢复',()=>{
  for(const change of [(m:Menu)=>m.lines[0].name='临时菜',(m:Menu)=>m.lines.push({...m.lines[0]}),(m:Menu)=>m.lines.pop(),(m:Menu)=>m.lines[0].quantity=2,(m:Menu)=>m.lines[0].preparation='加大份']) {
    const changed=structuredClone(base);change(changed);assert.notEqual(pricingContent(base),pricingContent(changed));
  }
  assert.equal(pricingContent(base),pricingContent(structuredClone(base)));
});
test('金额精确到分，空/非法/负数不伪装成零',()=>{
  assert.equal(amountMinor('2999'),299900);assert.equal(amountMinor('2899.01'),289901);assert.equal(amountMinor('0'),0);
  for(const input of ['', '-1','2.999','NaN','1e3']) assert.throws(()=>amountMinor(input));
});
