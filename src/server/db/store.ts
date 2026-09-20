import crypto from "node:crypto";
import { store } from "./client";
import type { PackageRow } from "./types";

// The additive write side: trips / itineraries / itinerary_items / bookings in
// data/packagepro.db. The given dataset is never written. Re-planning creates
// a new itinerary VERSION on the same trip and flips is_active; superseded
// items stay visible with status 'replaced'/'removed' (rule R8 — nothing is
// hard-deleted).

const now = () => new Date().toISOString();
const uid = (prefix: string) =>
  `${prefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;

export interface PersistItineraryInput {
  ownerUserId: string;
  originCityId: string | null;
  destinationCityId: string;
  title: string;
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  tripType: string;
  currency: string;
  totalCost: string;
  totalDurationMinutes: number;
  totalCarbonKg: string;
  items: {
    dayIndex: number;
    sortOrder: number;
    itemType: string;
    entityType: string | null;
    entityId: string | null;
    title: string;
    cost: string;
    carbonKg: string;
    durationMinutes: number;
    explanation: string;
    locked: boolean;
  }[];
}

export interface PersistResult {
  tripId: string;
  itineraryId: string;
  version: number;
}

function tripIdentity(input: PersistItineraryInput): string | undefined {
  const row = store()
    .prepare(
      `SELECT trip_id FROM trips
       WHERE owner_user_id = ? AND destination_city_id = ? AND start_date = ?
         AND end_date = ? AND adults = ? AND children = ?
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(
      input.ownerUserId,
      input.destinationCityId,
      input.startDate,
      input.endDate,
      input.adults,
      input.children,
    ) as { trip_id: string } | undefined;
  return row?.trip_id;
}

export function findActiveItinerary(tripId: string): string | undefined {
  const row = store()
    .prepare(
      "SELECT itinerary_id FROM itineraries WHERE trip_id = ? AND is_active = 1 LIMIT 1",
    )
    .get(tripId) as { itinerary_id: string } | undefined;
  return row?.itinerary_id;
}

export function latestVersion(tripId: string): number {
  const row = store()
    .prepare(
      "SELECT COALESCE(MAX(version), 0) AS v FROM itineraries WHERE trip_id = ?",
    )
    .get(tripId) as { v: number };
  return row.v;
}

/** R8: superseded items of the outgoing active version stay visible. */
export function supersedeItinerary(itineraryId: string): void {
  const db = store();
  const ts = now();
  db.prepare(
    "UPDATE itinerary_items SET status = 'replaced', updated_at = ? WHERE itinerary_id = ? AND status = 'confirmed'",
  ).run(ts, itineraryId);
  db.prepare(
    "UPDATE itineraries SET is_active = 0, updated_at = ? WHERE itinerary_id = ?",
  ).run(ts, itineraryId);
}

export function persistItinerary(
  input: PersistItineraryInput,
): PersistResult {
  const db = store();
  const ts = now();
  const tripId = tripIdentity(input) ?? uid("trp_");
  const version = latestVersion(tripId) + 1;

  const tripExists = !!findActiveItinerary(tripId) || !!tripIdentity(input);
  void tripExists;

  const res = db
    .prepare(
      `INSERT OR IGNORE INTO trips
         (trip_id, owner_user_id, title, origin_city_id, destination_city_id,
          start_date, end_date, party_size, adults, children, trip_type, status,
          home_currency, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, 'planning', ?, ?, ?)`,
    )
    .run(
      tripId,
      input.ownerUserId,
      input.title,
      input.originCityId,
      input.destinationCityId,
      input.startDate,
      input.endDate,
      input.adults + input.children,
      input.adults,
      input.children,
      input.tripType,
      input.currency,
      ts,
      ts,
    );

  const itineraryId = uid("itn_");
  db.prepare(
    `INSERT INTO itineraries
       (itinerary_id, trip_id, name, version, is_active, generated_by, total_cost,
        currency, total_duration_minutes, total_carbon_kg, status, created_at, updated_at)
     VALUES (?,?,?,?,1,'ai_planner',?,?,?,?,'active',?,?)`,
  ).run(
    itineraryId,
    tripId,
    input.title,
    version,
    input.totalCost,
    input.currency,
    input.totalDurationMinutes,
    input.totalCarbonKg,
    ts,
    ts,
  );

  const insertItem = db.prepare(
    `INSERT INTO itinerary_items
       (item_id, itinerary_id, day_index, sort_order, item_type, entity_type, entity_id,
        title, cost, currency, carbon_kg, duration_minutes, source, explanation, locked,
        status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'ai_planner', ?, ?, 'confirmed', ?, ?)`,
  );
  const tx = db.prepare("BEGIN").run();
  void tx;
  for (const item of input.items) {
    insertItem.run(
      uid("itm_"),
      itineraryId,
      item.dayIndex,
      item.sortOrder,
      item.itemType,
      item.entityType,
      item.entityId,
      item.title,
      item.cost,
      input.currency,
      item.carbonKg,
      item.durationMinutes,
      item.explanation,
      item.locked ? 1 : 0,
      ts,
      ts,
    );
  }
  db.prepare("COMMIT").run();

  // Any other active version for this trip becomes the archived predecessor.
  for (const other of db
    .prepare(
      "SELECT itinerary_id FROM itineraries WHERE trip_id = ? AND is_active = 1 AND itinerary_id <> ?",
    )
    .all(tripId, itineraryId) as { itinerary_id: string }[]) {
    supersedeItinerary(other.itinerary_id);
  }

  void res;
  return { tripId, itineraryId, version };
}

/** Stretch booking helper: idempotency guarantees a retried request → same row. */
export function createBooking(input: {
  userId: string;
  tripId: string | null;
  itineraryId: string | null;
  totalAmount: string;
  currency: string;
  idempotencyKey: string;
}): { bookingId: string; reference: string; created: boolean } {
  const db = store();
  const existing = db
    .prepare("SELECT * FROM bookings WHERE idempotency_key = ?")
    .get(input.idempotencyKey) as { booking_id: string; booking_reference: string } | undefined;
  if (existing) return { bookingId: existing.booking_id, reference: existing.booking_reference, created: false };

  const ts = now();
  const bookingId = uid("bkg_");
  const reference = crypto.randomBytes(3).toString("hex").toUpperCase();
  db.prepare(
    `INSERT INTO bookings
       (booking_id, user_id, trip_id, itinerary_id, booking_reference, channel,
        total_amount, currency, idempotency_key, status, created_at, updated_at)
     VALUES (?,?,?,?,?, 'web', ?, ?, ?, 'confirmed', ?, ?)`,
  ).run(
    bookingId,
    input.userId,
    input.tripId,
    input.itineraryId,
    reference,
    input.totalAmount,
    input.currency,
    input.idempotencyKey,
    ts,
    ts,
  );
  return { bookingId, reference, created: true };
}

/** Placeholder re-export for type convenience at call sites. */
export type { PackageRow };