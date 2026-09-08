import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryNativeStorage } from '../../stage2/platform/storage.ts';
import { seedStageThree, startReception, setRestrictedPresentation, WEDDING_2399_REVISION_ID, WEDDING_TYPE_ID } from '../web/stage3-repository.ts';
import { customerDocument, kitchenDocument } from '../web/stage3-documents.ts';

test('Slice A：快速接待创建匿名洽谈，并从 2399 标准套餐建立冻结基线草稿',async()=>{
  const storage=new MemoryNativeStorage(); await seedStageThree(storage);
  const {negotiationId,proposal}=await startReception(storage,WEDDING_TYPE_ID,WEDDING_2399_REVISION_ID);
  const database=await storage.read(), negotiation=database.negotiations[negotiationId], draft=database.drafts[proposal.currentDraftId];
  assert.equal(negotiation.customerId,undefined); assert.equal(negotiation.banquetTypeId,WEDDING_TYPE_ID);
  assert.equal(proposal.sourcePackageRevisionId,WEDDING_2399_REVISION_ID); assert.equal(draft.lines.length,4);
  assert.equal(draft.lines[0].name,'清蒸石斑');
  assert.deepEqual(database.timeline.map(event=>event.type),['negotiation.created','proposal.draftCreated']);
});

test('Slice B：客户展示授权也通过同一持久化快照保存',async()=>{
  const storage=new MemoryNativeStorage();await seedStageThree(storage);const {proposal}=await startReception(storage,WEDDING_TYPE_ID,WEDDING_2399_REVISION_ID);
  await setRestrictedPresentation(storage,proposal.id,true);assert.deepEqual((await storage.read()).presentation,{restricted:true,proposalId:proposal.id,authorizedPackageRevisionIds:[WEDDING_2399_REVISION_ID]});
});

test('Slice B：换菜、临时菜、删除均自动保存且 Undo 保留标准原菜',async()=>{
  const storage=new MemoryNativeStorage();await seedStageThree(storage);const {repository,proposal}=await startReception(storage,WEDDING_TYPE_ID,WEDDING_2399_REVISION_ID);
  const draftId=proposal.currentDraftId, original=(await storage.read()).drafts[draftId].lines[0];
  await repository.replaceLine(proposal.id,original.id,'dish-f-r1');await repository.replaceLine(proposal.id,original.id,'dish-b-r1');
  await repository.addTemporaryDish(proposal.id,'椒盐大连鲍');assert.equal((await storage.read()).drafts[draftId].lines.some(line=>line.name==='椒盐大连鲍'),true);
  await repository.deleteLine(proposal.id,original.id);await repository.undo(proposal.id);
  const restored=(await storage.read()).drafts[draftId].lines.find(line=>line.id===original.id)!;
  assert.equal(restored.name,'豉油皇焗波士顿龙虾');assert.equal(restored.baseItemId,original.baseItemId);assert.equal((await repository.undo(proposal.id)),true);
  assert.equal((await storage.read()).drafts[draftId].lines.some(line=>line.name==='椒盐大连鲍'),false);
});

test('Slice C：厨房参考价不会覆盖当前对客报价，菜单变化会使旧价失效',async()=>{
  const storage=new MemoryNativeStorage();await seedStageThree(storage);const {repository,proposal}=await startReception(storage,WEDDING_TYPE_ID,WEDDING_2399_REVISION_ID);
  const line=(await storage.read()).drafts[proposal.currentDraftId].lines[0];await repository.replaceLine(proposal.id,line.id,'dish-f-r1');
  const request=await repository.createKitchenRequest(proposal.id);const kitchen=await repository.recordQuote(proposal.id,request.sourceVersionId,'kitchenReference',289900,request.id);
  const quoteVersion=await repository.freeze(proposal.id,'customerQuote');const customer=await repository.recordQuote(proposal.id,quoteVersion.id,'customer',299900);
  assert.equal(kitchen.amountMinor,289900);assert.equal(customer.amountMinor,299900);assert.equal((await storage.read()).proposals[proposal.id].currentCustomerQuoteId,customer.id);
  assert.equal(await repository.isQuoteValid(proposal.id,customer.id),true);await repository.addTemporaryDish(proposal.id,'临时加菜');assert.equal(await repository.isQuoteValid(proposal.id,customer.id),false);
});

test('Slice D：客户 DTO 白名单不泄漏厨房价或修改痕迹，厨房 DTO 显示差异',async()=>{
  const storage=new MemoryNativeStorage();await seedStageThree(storage);const {repository,proposal}=await startReception(storage,WEDDING_TYPE_ID,WEDDING_2399_REVISION_ID);const line=(await storage.read()).drafts[proposal.currentDraftId].lines[0];await repository.replaceLine(proposal.id,line.id,'dish-f-r1');const request=await repository.createKitchenRequest(proposal.id);const version=await repository.freeze(proposal.id,'customerQuote');await repository.recordQuote(proposal.id,version.id,'customer',299900);
  const db=await storage.read(), customer=customerDocument(db,proposal.id,'receipt'), kitchen=kitchenDocument(db,proposal.id);
  assert.equal(JSON.stringify(customer).includes('pricingFingerprint'),false);assert.equal(JSON.stringify(customer).includes('requestCode'),false);assert.equal(customer.priceMinor,299900);assert.equal(kitchen.requestCode,request.shortCode);assert.equal(kitchen.lines[0].change,'replaced');
});

test('Slice E：客户确认冻结菜单与报价，重启后的 Repository 可从最近洽谈续接',async()=>{
  const storage=new MemoryNativeStorage();await seedStageThree(storage);const {repository,negotiationId,proposal}=await startReception(storage,WEDDING_TYPE_ID,WEDDING_2399_REVISION_ID);const version=await repository.freeze(proposal.id,'customerQuote');const quote=await repository.recordQuote(proposal.id,version.id,'customer',299900);await repository.confirm(proposal.id,{name:'张女士',phone:'13800000000'});
  const before=await storage.read(), confirmation=Object.values(before.confirmations)[0], frozenName=confirmation.menuSnapshot.lines[0].name;before.dishRevisions['dish-a-r1'].cn='菜库已改名';
  const after=await storage.read(), resumedProposal=Object.values(after.proposals).find(item=>item.negotiationId===negotiationId)!;
  assert.equal(confirmation.quoteRecordId,quote.id);assert.equal(confirmation.menuSnapshot.lines[0].name,frozenName);assert.equal(resumedProposal.id,proposal.id);assert.equal(after.timeline.some(event=>event.type==='proposal.confirmed'),true);
});
