import { catalogue } from "@/server/db/client";

// Read-only aggregate: popular signature hotels by (review-weighted) guest
// score. Cached per process — PS-04.db is immutable, so this never goes stale.

let cache: { id: string; score: number; reviewCount: number }[] | null = null;

export function getHotelStatsFromDb(): { id: string; score: number; reviewCount: number }[] {
  if (cache) return cache;
  const rows = catalogue()
    .prepare(
      "SELECT hotel_id AS id, guest_score AS score, review_count AS reviewCount FROM hotels WHERE guest_score IS NOT NULL",
    )
    .all() as { id: string; score: number; reviewCount: number }[];
  cache = rows.map((r) => ({ id: r.id, score: Number(r.score), reviewCount: Number(r.reviewCount) }));
  return cache;
}

export function resetHotelStatsCache(): void {
  cache = null;
}