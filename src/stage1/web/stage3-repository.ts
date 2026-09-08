import { ProposalRepository } from '../../stage2/data/repository.ts';
import { emptyDatabase, id, now } from '../../stage2/domain/model.ts';
import type { Database, Id } from '../../stage2/domain/model.ts';
import type { NativeStorage } from '../../stage2/platform/storage.ts';

export const SALES_STAFF_ID='staff-sales-1';
export const WEDDING_TYPE_ID='banquet-wedding';
export const BIRTHDAY_TYPE_ID='banquet-birthday';
export const WEDDING_2399_REVISION_ID='package-wedding-2399-r1';
export const WEDDING_2699_REVISION_ID='package-wedding-2699-r1';

export interface StageThreeBridge { read(): Promise<{empty:boolean;revision:number;payload?:string}>; commit(options:{payload:string;baseRevision:number}): Promise<{revision:number}>; reset(): Promise<void>; exportDocument(options:{document:string;template:'kitchen'|'receipt'|'photo'}): Promise<{files:string[]}>; }

/** The WebView uses the Stage 2 repository against the native SQLite-backed snapshot contract. */
export class AndroidNativeStorage implements NativeStorage {
  private revision=0;
  private readonly bridge:StageThreeBridge;
  constructor(bridge:StageThreeBridge) { this.bridge=bridge; }
  async read():Promise<Database>{ const result=await this.bridge.read(); this.revision=result.revision; return result.empty ? emptyDatabase('android-stage3') : JSON.parse(result.payload!) as Database; }
  async transaction<T>(work:(database:Database)=>T|Promise<T>):Promise<T>{ const database=await this.read(); const result=await work(database); database.revision=this.revision+1; const committed=await this.bridge.commit({payload:JSON.stringify(database),baseRevision:this.revision}); this.revision=committed.revision; return structuredClone(result); }
}

export function seedStageThree(storage:NativeStorage):Promise<void> { return storage.transaction(database=>{
  if(database.staff[SALES_STAFF_ID]) return;
  database.staff[SALES_STAFF_ID]={id:SALES_STAFF_ID,hotelId:'hotel-synthetic',displayName:'宴会销售',role:'sales',status:'active'};
  database.banquetTypes[WEDDING_TYPE_ID]={id:WEDDING_TYPE_ID,name:'婚宴',sortOrder:1,status:'active'};
  database.banquetTypes[BIRTHDAY_TYPE_ID]={id:BIRTHDAY_TYPE_ID,name:'寿宴',sortOrder:2,status:'active'};
  const dishes=[['dish-a','清蒸石斑','海鲜'],['dish-b','豉油皇焗波士顿龙虾','海鲜'],['dish-c','花旗参炖老鸡汤','汤羹'],['dish-d','至尊烧鹅拼盘','烧味'],['dish-e','时蔬双拼','蔬菜'],['dish-f','椒盐大连鲍','海鲜']];
  for(const [dishId,cn,category] of dishes){const revisionId=`${dishId}-r1`;database.dishes[dishId]={id:dishId,currentRevisionId:revisionId,status:'active'};database.dishRevisions[revisionId]={id:revisionId,dishId,cn,categoryId:category,createdAt:now()};}
  const makePackage=(revisionId:Id,packageId:Id,code:string,name:string,priceMinor:number,dishIds:string[],recommended:boolean)=>{
    database.packages[packageId]={id:packageId,banquetTypeId:WEDDING_TYPE_ID,currentRevisionId:revisionId,status:'active'};
    database.packageRevisions[revisionId]={id:revisionId,packageId,code,name,priceMinor,recommended,createdAt:now(),items:dishIds.map((dishId,position)=>({id:id(),dishId,dishRevisionId:`${dishId}-r1`,position}))};
  };
  makePackage(WEDDING_2399_REVISION_ID,'package-wedding-2399','W-2399','锦绣婚宴',239900,['dish-a','dish-c','dish-d','dish-e'],false);
  makePackage(WEDDING_2699_REVISION_ID,'package-wedding-2699','W-2699','臻选婚宴',269900,['dish-b','dish-c','dish-d','dish-e'],true);
  const birthdayPackageId='package-birthday-2399', birthdayRevisionId='package-birthday-2399-r1';
  database.packages[birthdayPackageId]={id:birthdayPackageId,banquetTypeId:BIRTHDAY_TYPE_ID,currentRevisionId:birthdayRevisionId,status:'active'};
  database.packageRevisions[birthdayRevisionId]={id:birthdayRevisionId,packageId:birthdayPackageId,code:'B-2399',name:'福寿宴',priceMinor:239900,recommended:true,createdAt:now(),items:['dish-a','dish-c','dish-d','dish-e'].map((dishId,position)=>({id:id(),dishId,dishRevisionId:`${dishId}-r1`,position}))};
 }); }

export async function startReception(storage:NativeStorage, banquetTypeId:Id, packageRevisionId:Id){
  const repository=new ProposalRepository(storage,SALES_STAFF_ID);
  const {negotiationId}=await repository.createAnonymousNegotiation(banquetTypeId);
  const proposal=await repository.createDraftFromPackage(negotiationId,packageRevisionId);
  return {repository,negotiationId,proposal};
}

export async function setRestrictedPresentation(storage:NativeStorage, proposalId:Id, restricted:boolean):Promise<void>{
  await storage.transaction(database=>{const proposal=database.proposals[proposalId];if(!proposal)throw new Error('方案不存在');database.presentation={restricted,proposalId,authorizedPackageRevisionIds:[proposal.sourcePackageRevisionId]};});
}
