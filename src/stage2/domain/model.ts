import { createHash, randomUUID } from 'node:crypto';

export const SCHEMA_VERSION = 2;
export type Id = string;
export type MoneyMinor = number;
export type StaffRole = 'sales' | 'operations';
export type EntityStatus = 'active' | 'inactive';
export type ProposalVersionKind = 'revision' | 'kitchenInquiry' | 'customerQuote' | 'customerConfirmation';
export type QuoteKind = 'kitchenReference' | 'customer';

export interface StaffProfile { id: Id; hotelId: Id; displayName: string; role: StaffRole; status: EntityStatus }
export interface BanquetType { id: Id; name: string; sortOrder: number; status: EntityStatus }
export interface MediaAsset { id: Id; contentHash: string; mime: string; width?: number; height?: number; localPath?: string; bytes?: number; source?: string }
export interface Crop { x: number; y: number; w?: number; h?: number; legacyFormat?: 'y-percent' | 'rect' }
export interface Dish { id: Id; legacyId?: string; currentRevisionId: Id; status: EntityStatus }
export interface DishRevision { id: Id; dishId: Id; cn: string; en?: string; categoryId?: Id; description?: string; imageAssetId?: Id; crop?: Crop; createdAt: string }
export interface PackageItem { id: Id; dishId: Id; dishRevisionId: Id; position: number; nameOverride?: { cn?: string; en?: string } }
export interface Package { id: Id; banquetTypeId: Id; legacyId?: string; currentRevisionId: Id; status: EntityStatus }
export interface PackageRevision { id: Id; packageId: Id; code: string; name: string; priceMinor: MoneyMinor; recommended: boolean; items: PackageItem[]; createdAt: string }
export interface Customer { id: Id; ownerStaffId: Id; name?: string; phone?: string; notes?: string }
export interface Negotiation { id: Id; customerId?: Id; ownerStaffId: Id; startedAt: string; status: 'active' | 'followUp' | 'closed'; banquetTypeId: Id; eventDate?: string; tableCount?: number; budgetMinor?: MoneyMinor; followUpDate?: string }
export interface TemporaryDish { id: Id; proposalId: Id; name: string; categoryId?: Id; governanceStatus: 'candidate' | 'ignored' | 'promoted' }
export interface DraftLine { id: Id; baseItemId?: Id; source: 'library' | 'temporary'; dishRevisionId?: Id; temporaryDishId?: Id; name: string; quantity: number; preparation?: string; position: number }
export interface ProposalDraft { id: Id; proposalId: Id; parentVersionId?: Id; contentRevision: number; lines: DraftLine[]; notes?: string; updatedAt: string }
export interface Proposal { id: Id; negotiationId: Id; ownerStaffId: Id; sourcePackageRevisionId: Id; currentDraftId: Id; latestVersionId?: Id; currentCustomerQuoteId?: Id }
export interface FrozenContent { lines: DraftLine[]; sourcePackageRevisionId: Id; standardPriceMinor: MoneyMinor; brandRevisionId?: Id; pricingFingerprint: string; fullContentHash: string }
export interface ProposalVersion { id: Id; proposalId: Id; ordinal: number; parentVersionId?: Id; kind: ProposalVersionKind; contentHash: string; frozenContent: FrozenContent; priceRecordIds: Id[]; brandRevisionId?: Id; createdBy: Id; createdAt: string }
export interface KitchenRequest { id: Id; sourceVersionId: Id; pricingFingerprint: string; shortCode: string; createdAt: string; status: 'open' | 'answered' | 'cancelled' }
export interface QuoteRecord { id: Id; proposalId: Id; versionId: Id; pricingFingerprint: string; kind: QuoteKind; amountMinor: MoneyMinor; requestId?: Id; createdBy: Id; createdAt: string; supersedesId?: Id }
export interface CustomerConfirmation { id: Id; proposalVersionId: Id; quoteRecordId: Id; menuSnapshot: FrozenContent; customerSnapshot: Partial<Customer>; banquetSnapshot: Pick<Negotiation, 'banquetTypeId' | 'eventDate' | 'tableCount' | 'budgetMinor'>; staffSnapshot: Pick<StaffProfile, 'id' | 'displayName'>; confirmedAt: string; supersedesId?: Id }
export interface TimelineEvent { id: Id; negotiationId: Id; actorId: Id; deviceId: Id; sequence: number; type: string; entityId: Id; createdAt: string; payload: Record<string, unknown> }

export interface Database {
  schemaVersion: number; revision: number; deviceId: Id; sequence: number;
  staff: Record<Id, StaffProfile>; banquetTypes: Record<Id, BanquetType>; mediaAssets: Record<Id, MediaAsset>;
  dishes: Record<Id, Dish>; dishRevisions: Record<Id, DishRevision>; packages: Record<Id, Package>; packageRevisions: Record<Id, PackageRevision>;
  customers: Record<Id, Customer>; negotiations: Record<Id, Negotiation>; proposals: Record<Id, Proposal>; drafts: Record<Id, ProposalDraft>; temporaryDishes: Record<Id, TemporaryDish>;
  proposalVersions: Record<Id, ProposalVersion>; kitchenRequests: Record<Id, KitchenRequest>; quoteRecords: Record<Id, QuoteRecord>; confirmations: Record<Id, CustomerConfirmation>; timeline: TimelineEvent[];
  migrations: Record<string, { inputHash: string; migrationVersion: number; importedAt: string }>;
}
export const emptyDatabase = (deviceId = 'device-local'): Database => ({ schemaVersion: SCHEMA_VERSION, revision: 0, deviceId, sequence: 0, staff:{}, banquetTypes:{}, mediaAssets:{}, dishes:{}, dishRevisions:{}, packages:{}, packageRevisions:{}, customers:{}, negotiations:{}, proposals:{}, drafts:{}, temporaryDishes:{}, proposalVersions:{}, kitchenRequests:{}, quoteRecords:{}, confirmations:{}, timeline:[], migrations:{} });
export const id = (): Id => randomUUID();
export const now = (): string => new Date().toISOString();
export function hash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function assertMoney(value: number): asserts value is MoneyMinor { if (!Number.isSafeInteger(value) || value < 0) throw new Error('金额必须为非负整数分'); }
export function pricingFingerprint(lines: DraftLine[]): string {
  return hash(lines.map(line => [line.source, line.dishRevisionId ?? line.temporaryDishId, line.name.normalize('NFC'), line.quantity, (line.preparation ?? '').normalize('NFC')]).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en')));
}
export function fullContentHash(lines: DraftLine[]): string { return hash(lines.map(line => ({ ...line })).sort((a,b) => a.position - b.position)); }
