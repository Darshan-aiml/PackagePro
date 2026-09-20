import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// Two databases:
//  - PS-04.db  — the immutable, given catalogue. Opened READ-ONLY. Never written.
//  - packagepro.db — our own additive state (trips, itineraries, bookings),
//    bootstrapped on first use, gitignored.
// The catalogue resolves from the repo root's data/ folder. The write store
// resolves there too, but PACKAGEPRO_DATA_DIR redirects it for tests.

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_DIR = process.env.PACKAGEPRO_DATA_DIR ?? DATA_DIR;

let catalogueHandle: DatabaseSync | null = null;
let storeHandle: DatabaseSync | null = null;
let schemaBootstrapped = false;

function requireDataFile(file: string): string {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) {
    throw new Error(
      `${file} not found at ${p}. Run with web/ as the working directory (pnpm dev), or set PACKAGEPRO_DATA_DIR.`,
    );
  }
  return p;
}

export function catalogue(): DatabaseSync {
  if (catalogueHandle) return catalogueHandle;
  catalogueHandle = new DatabaseSync(requireDataFile("PS-04.db"), {
    readOnly: true,
  });
  catalogueHandle.exec("PRAGMA query_only = ON");
  return catalogueHandle;
}

export function store(): DatabaseSync {
  if (storeHandle) return storeHandle;
  const p = path.join(STORE_DIR, "packagepro.db");
  storeHandle = new DatabaseSync(p);
  bootstrap(storeHandle);
  return storeHandle;
}

function bootstrap(db: DatabaseSync): void {
  if (schemaBootstrapped) return;
  schemaBootstrapped = true;
  db.exec(`
    CREATE TABLE IF NOT EXISTS trips (
      trip_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      origin_city_id TEXT,
      destination_city_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      adults INTEGER NOT NULL,
      children INTEGER NOT NULL,
      trip_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planning',
      home_currency TEXT NOT NULL DEFAULT 'INR',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS itineraries (
      itinerary_id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      name TEXT NOT NULL,
      version INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      generated_by TEXT NOT NULL DEFAULT 'ai_planner',
      total_cost TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      total_duration_minutes INTEGER NOT NULL DEFAULT 0,
      total_carbon_kg TEXT NOT NULL DEFAULT '0.000',
      optimizer_weights TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS itinerary_items (
      item_id TEXT PRIMARY KEY,
      itinerary_id TEXT NOT NULL,
      day_index INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      starts_at TEXT,
      ends_at TEXT,
      item_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      title TEXT NOT NULL,
      cost TEXT NOT NULL DEFAULT '0.00',
      currency TEXT NOT NULL DEFAULT 'INR',
      carbon_kg TEXT NOT NULL DEFAULT '0.000',
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'ai_planner',
      explanation TEXT,
      locked INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookings (
      booking_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      trip_id TEXT,
      itinerary_id TEXT,
      booking_reference TEXT NOT NULL UNIQUE,
      channel TEXT NOT NULL DEFAULT 'web',
      total_amount TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      tax_amount TEXT NOT NULL DEFAULT '0.00',
      idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      confirmed_at TEXT,
      cancelled_at TEXT,
      cancellation_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export const isNodeSqlite = true;