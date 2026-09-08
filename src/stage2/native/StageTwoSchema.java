package hotel.shanshui.stage2;

/**
 * Native SQLite schema owned by the future Capacitor narrow storage plugin.
 * The web layer sends typed commands only; it never receives an SQL handle.
 * Every command writes its domain rows and timeline_event inside one beginTransaction block.
 */
final class StageTwoSchema {
  static final int VERSION = 2;
  static final String[] CREATE = {
    "CREATE TABLE schema_meta(version INTEGER NOT NULL)",
    "CREATE TABLE staff_profile(id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL)",
    "CREATE TABLE banquet_type(id TEXT PRIMARY KEY, name TEXT NOT NULL, sort_order INTEGER NOT NULL, status TEXT NOT NULL)",
    "CREATE TABLE media_asset(id TEXT PRIMARY KEY, content_hash TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, local_path TEXT, bytes INTEGER)",
    "CREATE TABLE dish(id TEXT PRIMARY KEY, legacy_id TEXT, current_revision_id TEXT NOT NULL, status TEXT NOT NULL)",
    "CREATE TABLE dish_revision(id TEXT PRIMARY KEY, dish_id TEXT NOT NULL REFERENCES dish(id), payload_json TEXT NOT NULL)",
    "CREATE TABLE package(id TEXT PRIMARY KEY, banquet_type_id TEXT NOT NULL REFERENCES banquet_type(id), legacy_id TEXT, current_revision_id TEXT NOT NULL, status TEXT NOT NULL)",
    "CREATE TABLE package_revision(id TEXT PRIMARY KEY, package_id TEXT NOT NULL REFERENCES package(id), price_minor INTEGER NOT NULL CHECK(price_minor >= 0), payload_json TEXT NOT NULL)",
    "CREATE TABLE package_item(id TEXT PRIMARY KEY, package_revision_id TEXT NOT NULL REFERENCES package_revision(id), dish_revision_id TEXT NOT NULL REFERENCES dish_revision(id), position INTEGER NOT NULL, override_json TEXT)",
    "CREATE TABLE customer(id TEXT PRIMARY KEY, owner_staff_id TEXT NOT NULL REFERENCES staff_profile(id), payload_json TEXT NOT NULL)",
    "CREATE TABLE negotiation(id TEXT PRIMARY KEY, customer_id TEXT, owner_staff_id TEXT NOT NULL REFERENCES staff_profile(id), payload_json TEXT NOT NULL)",
    "CREATE TABLE proposal(id TEXT PRIMARY KEY, negotiation_id TEXT NOT NULL REFERENCES negotiation(id), owner_staff_id TEXT NOT NULL REFERENCES staff_profile(id), current_draft_id TEXT NOT NULL, payload_json TEXT NOT NULL)",
    "CREATE TABLE proposal_draft(id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL REFERENCES proposal(id), content_revision INTEGER NOT NULL, payload_json TEXT NOT NULL)",
    "CREATE TABLE draft_line(id TEXT PRIMARY KEY, draft_id TEXT NOT NULL REFERENCES proposal_draft(id), base_item_id TEXT, source TEXT NOT NULL, position INTEGER NOT NULL, payload_json TEXT NOT NULL)",
    "CREATE TABLE temporary_dish(id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL REFERENCES proposal(id), name TEXT NOT NULL, category_id TEXT, governance_status TEXT NOT NULL)",
    "CREATE TABLE proposal_version(id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL REFERENCES proposal(id), ordinal INTEGER NOT NULL, kind TEXT NOT NULL, content_hash TEXT NOT NULL, frozen_json TEXT NOT NULL, UNIQUE(proposal_id, ordinal))",
    "CREATE TABLE kitchen_request(id TEXT PRIMARY KEY, source_version_id TEXT NOT NULL REFERENCES proposal_version(id), pricing_fingerprint TEXT NOT NULL, short_code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, status TEXT NOT NULL)",
    "CREATE TABLE quote_record(id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL REFERENCES proposal(id), version_id TEXT NOT NULL REFERENCES proposal_version(id), pricing_fingerprint TEXT NOT NULL, kind TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0), payload_json TEXT NOT NULL)",
    "CREATE TABLE customer_confirmation(id TEXT PRIMARY KEY, proposal_version_id TEXT NOT NULL REFERENCES proposal_version(id), quote_record_id TEXT NOT NULL REFERENCES quote_record(id), snapshot_json TEXT NOT NULL, confirmed_at TEXT NOT NULL)",
    "CREATE TABLE timeline_event(id TEXT PRIMARY KEY, negotiation_id TEXT NOT NULL REFERENCES negotiation(id), sequence INTEGER NOT NULL, type TEXT NOT NULL, entity_id TEXT NOT NULL, payload_json TEXT NOT NULL, UNIQUE(negotiation_id, sequence))",
    "CREATE TABLE migration_manifest(source_id TEXT PRIMARY KEY, input_hash TEXT NOT NULL, migration_version INTEGER NOT NULL, imported_at TEXT NOT NULL)"
  };
  private StageTwoSchema() {}
}
