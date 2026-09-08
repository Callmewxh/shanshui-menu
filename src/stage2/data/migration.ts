import { hash, id, now } from '../domain/model.ts';
import type { Database } from '../domain/model.ts';
import type { NativeStorage } from '../platform/storage.ts';

export interface LegacyBundle { sourceId: string; config: { schemaVersion: number; banquets?: {id:string;name:string}[]; categories?: string[]; library?: Record<string,{cn:string;en?:string;category?:string;image?:string;crop?:unknown}>; menu?: Record<string,{packages?: {id:string;name:string;price:number;dishes:string[];nameOverrides?:Record<string,string|{cn?:string;en?:string}>}[]}>; logo?: string }; assets?: Record<string,{mime:string;bytes:number;contentHash?:string}> }
export interface MigrationReport { sourceId:string; inputHash:string; imported:boolean; dishes:number; packages:number; missingImages:string[]; danglingReferences:string[]; warnings:string[] }
const requireText=(value:unknown,label:string)=>{if(typeof value!=='string'||!value.trim())throw new Error(`${label} 无效`);return value.trim()};
const toMinor=(price:number)=>{ if(!Number.isFinite(price)||price<0||Math.round(price*100)!==price*100)throw new Error('非法套餐金额');return Math.round(price*100) };

/** Deterministic source namespaces preserve same-named dishes from different devices. Input is never mutated. */
export async function migrateLegacyBundle(storage: NativeStorage, input: LegacyBundle): Promise<MigrationReport> {
  const bundle=structuredClone(input), inputHash=hash(bundle), sourceId=requireText(bundle.sourceId,'sourceId');
  return storage.transaction(db=>{
    if(db.migrations[sourceId]?.inputHash===inputHash) return {sourceId,inputHash,imported:false,dishes:0,packages:0,missingImages:[],danglingReferences:[],warnings:[]} as MigrationReport;
    if(db.migrations[sourceId] && db.migrations[sourceId].inputHash!==inputHash) throw new Error('同一来源已用不同输入导入；请显式创建新来源');
    if(bundle.config.schemaVersion>3) throw new Error('旧包 schema 较新，拒绝迁移');
    const report:MigrationReport={sourceId,inputHash,imported:true,dishes:0,packages:0,missingImages:[],danglingReferences:[],warnings:[]};
    const categoryMap=new Map<string,string>(); for(const category of bundle.config.categories??[]){const key=`${sourceId}:category:${category}`;categoryMap.set(category,key);}
    for(const banquet of bundle.config.banquets??[]){ const bid=`${sourceId}:banquet:${banquet.id}`; db.banquetTypes[bid]??={id:bid,name:requireText(banquet.name,'宴会名'),sortOrder:Object.keys(db.banquetTypes).length,status:'active'}; }
    for(const [legacyId,raw] of Object.entries(bundle.config.library??{})){
      const dishId=`${sourceId}:dish:${legacyId}`; if(db.dishes[dishId])continue; const revisionId=id(), imageAssetId=raw.image ? `${sourceId}:asset:${raw.image}` : undefined;
      if(raw.image && !bundle.assets?.[raw.image]) report.missingImages.push(raw.image);
      if(raw.image && bundle.assets?.[raw.image]) { const asset=bundle.assets[raw.image], contentHash=asset.contentHash??hash(asset); db.mediaAssets[contentHash]??={id:contentHash,contentHash,mime:asset.mime,bytes:asset.bytes,source:sourceId}; }
      db.dishes[dishId]={id:dishId,legacyId,currentRevisionId:revisionId,status:'active'}; db.dishRevisions[revisionId]={id:revisionId,dishId,cn:requireText(raw.cn,`菜品 ${legacyId}`),en:raw.en,categoryId:raw.category?categoryMap.get(raw.category):undefined,imageAssetId:imageAssetId&&bundle.assets?.[raw.image!]? (bundle.assets[raw.image!].contentHash??hash(bundle.assets[raw.image!])):undefined,crop:raw.crop as any,createdAt:now()}; report.dishes++;
    }
    for(const [legacyBanquet,group] of Object.entries(bundle.config.menu??{})) for(const legacyPackage of group.packages??[]){
      const banquetTypeId=`${sourceId}:banquet:${legacyBanquet}`; if(!db.banquetTypes[banquetTypeId]) { db.banquetTypes[banquetTypeId]={id:banquetTypeId,name:legacyBanquet,sortOrder:Object.keys(db.banquetTypes).length,status:'active'}; report.warnings.push(`未知宴会 ${legacyBanquet} 已保留`); }
      const packageId=`${sourceId}:package:${legacyBanquet}:${legacyPackage.id}`; if(db.packages[packageId]) continue; const revisionId=id(); const items=legacyPackage.dishes.map((legacyDish,index)=>{const dishId=`${sourceId}:dish:${legacyDish}`,dish=db.dishes[dishId]; if(!dish){report.danglingReferences.push(`${legacyPackage.id}:${legacyDish}`); throw new Error(`悬空菜品引用 ${legacyPackage.id}:${legacyDish}`);} const override=legacyPackage.nameOverrides?.[legacyDish]; return {id:id(),dishId,dishRevisionId:dish.currentRevisionId,position:index,nameOverride:typeof override==='string'?{cn:override}:override};});
      db.packages[packageId]={id:packageId,banquetTypeId,legacyId:legacyPackage.id,currentRevisionId:revisionId,status:'active'}; db.packageRevisions[revisionId]={id:revisionId,packageId,code:legacyPackage.id,name:requireText(legacyPackage.name,'套餐名'),priceMinor:toMinor(legacyPackage.price),recommended:false,items,createdAt:now()};report.packages++;
    }
    db.migrations[sourceId]={inputHash,migrationVersion:1,importedAt:now()}; return report;
  });
}

export function validateDatabase(db: Database): string[] { const errors:string[]=[]; for(const revision of Object.values(db.packageRevisions)) for(const item of revision.items) if(!db.dishRevisions[item.dishRevisionId]) errors.push(`悬空菜品修订: ${item.id}`); for(const dishRevision of Object.values(db.dishRevisions)) if(dishRevision.imageAssetId&&!db.mediaAssets[dishRevision.imageAssetId]) errors.push(`缺图资源: ${dishRevision.id}`); return errors; }
