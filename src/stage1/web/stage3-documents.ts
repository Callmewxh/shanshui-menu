import type { Database, Id } from '../../stage2/domain/model.ts';

export type CustomerDocument={audience:'customer';style:'receipt'|'photo';title:string;priceMinor:number;lines:{name:string;imageAssetId?:string}[]};
export type KitchenDocument={audience:'kitchen';requestCode:string;lines:{before?:string;after?:string;change:'unchanged'|'replaced'|'added'}[]};
export function customerDocument(db:Database,proposalId:Id,style:'receipt'|'photo'):CustomerDocument{
  const proposal=db.proposals[proposalId],draft=db.drafts[proposal.currentDraftId],quote=proposal.currentCustomerQuoteId&&db.quoteRecords[proposal.currentCustomerQuoteId];if(!quote)throw new Error('请先设定当前对客报价');
  return {audience:'customer',style,title:db.packageRevisions[proposal.sourcePackageRevisionId].name,priceMinor:quote.amountMinor,lines:draft.lines.map(line=>({name:line.name,imageAssetId:style==='photo'?db.dishRevisions[line.dishRevisionId??'']?.imageAssetId:undefined}))};
}
export function kitchenDocument(db:Database,proposalId:Id):KitchenDocument{
  const proposal=db.proposals[proposalId],draft=db.drafts[proposal.currentDraftId],source=db.packageRevisions[proposal.sourcePackageRevisionId],request=Object.values(db.kitchenRequests).find(item=>db.proposalVersions[item.sourceVersionId]?.proposalId===proposalId);if(!request)throw new Error('请先生成厨房询价');
  const base=new Map(source.items.map(item=>[item.id,db.dishRevisions[item.dishRevisionId]?.cn??item.dishRevisionId]));return {audience:'kitchen',requestCode:request.shortCode,lines:draft.lines.map(line=>({before:line.baseItemId?base.get(line.baseItemId):undefined,after:line.name,change:line.source==='temporary'?'added':line.baseItemId&&base.get(line.baseItemId)!==line.name?'replaced':'unchanged'}))};
}
