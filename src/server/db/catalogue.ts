import { catalogue } from "./client";
import type {
  CityRow,
  ComponentRow,
  CurrencyRow,
  GuideRow,
  HotelRow,
  LanguageRow,
  PackageRow,
  PriceHistoryRow,
  RoomTypeRow,
  TransferRow,
  UserPreferencesRow,
  UserRow,
} from "./types";

// Typed read queries over PS-04.db. Money fields stay TEXT end to end; the
// decimal/decimal.js boundary lives in engines, never here.

type SqlValue = string | number | null;

function all<T>(sql: string, ...params: SqlValue[]): T[] {
  return catalogue().prepare(sql).all(...params) as unknown as T[];
}

function get<T>(sql: string, ...params: SqlValue[]): T | undefined {
  return catalogue().prepare(sql).get(...params) as unknown as T | undefined;
}

export function listCities(): CityRow[] {
  return all<CityRow>(
    "SELECT * FROM cities WHERE status = 'active' ORDER BY name",
  );
}

export function getCity(cityId: string): CityRow | undefined {
  return get<CityRow>(
    "SELECT * FROM cities WHERE city_id = ?",
    cityId,
  );
}

export function listPackages(): PackageRow[] {
  return all<PackageRow>(
    "SELECT * FROM tour_packages WHERE status = 'active' ORDER BY base_price COLLATE NOCASE",
  );
}

export function getPackage(packageId: string): PackageRow | undefined {
  return get<PackageRow>(
    "SELECT * FROM tour_packages WHERE package_id = ?",
    packageId,
  );
}

/** All components of a package, day-then-slot ordered. Swap groups are package-local. */
export function listComponents(packageId: string): ComponentRow[] {
  return all<ComponentRow>(
    "SELECT * FROM package_components WHERE package_id = ? ORDER BY day_index, slot",
    packageId,
  );
}

export function getComponent(componentId: string): ComponentRow | undefined {
  return get<ComponentRow>(
    "SELECT * FROM package_components WHERE component_id = ?",
    componentId,
  );
}

/** Every component sharing the swap group — the alternatives to pick from. */
export function listSwapAlternatives(
  packageId: string,
  swapGroup: string,
): ComponentRow[] {
  if (!swapGroup) return [];
  return all<ComponentRow>(
    "SELECT * FROM package_components WHERE package_id = ? AND swap_group = ?",
    packageId,
    swapGroup,
  );
}

export function listHotels(cityId: string, currencies?: string[]): HotelRow[] {
  const where = ["status = 'active'", "city_id = ?"];
  const params: SqlValue[] = [cityId];
  if (currencies && currencies.length > 0) {
    where.push(`base_currency IN (${currencies.map(() => "?").join(",")})`);
    params.push(...currencies);
  }
  return all<HotelRow>(
    `SELECT * FROM hotels WHERE ${where.join(" AND ")}`,
    ...params,
  );
}

export function listRoomTypes(hotelId: string): RoomTypeRow[] {
  return all<RoomTypeRow>(
    "SELECT * FROM hotel_room_types WHERE hotel_id = ? AND status = 'active'",
    hotelId,
  );
}

export function getCurrency(iso4217: string): CurrencyRow | undefined {
  return get<CurrencyRow>(
    "SELECT * FROM currencies WHERE iso4217 = ?",
    iso4217,
  );
}

export function listCurrencies(): CurrencyRow[] {
  return all<CurrencyRow>("SELECT * FROM currencies");
}

export function getLanguage(bcp47: string): LanguageRow | undefined {
  return get<LanguageRow>(
    "SELECT * FROM languages WHERE bcp47 = ?",
    bcp47,
  );
}

export function listLanguages(): LanguageRow[] {
  return all<LanguageRow>(
    "SELECT * FROM languages ORDER BY english_name",
  );
}

export function getUser(userId: string): UserRow | undefined {
  return get<UserRow>(
    "SELECT * FROM users WHERE user_id = ?",
    userId,
  );
}

export function getUserPreferences(userId: string): UserPreferencesRow | undefined {
  return get<UserPreferencesRow>(
    "SELECT * FROM user_preferences WHERE user_id = ?",
    userId,
  );
}

export function listGuides(cityId?: string): GuideRow[] {
  const base = "SELECT * FROM tour_guides WHERE status = 'active'";
  if (!cityId) return all<GuideRow>(base);
  return all<GuideRow>(`${base} AND city_id = ?`, cityId);
}

/** True if the guide is free on every one of the dates, with ≥1 slot. */
export function guideFreeDates(
  guideId: string,
  dates: string[],
): { forDate: string; available: boolean; multiplier: string }[] {
  return dates.map((forDate) => {
    const row = get<{
      for_date: string;
      is_available: number;
      slots_available: number;
      price_multiplier: string;
    }>(
      "SELECT for_date, is_available, slots_available, price_multiplier FROM guide_availability WHERE guide_id = ? AND for_date = ?",
      guideId,
      forDate,
    );
    return {
      forDate,
      available: row ? row.is_available === 1 && row.slots_available >= 1 : false,
      multiplier: row ? row.price_multiplier : "1.00",
    };
  });
}

export function listTransfers(cityId: string): TransferRow[] {
  return all<TransferRow>(
    "SELECT * FROM transfers WHERE city_id = ? AND status = 'active'",
    cityId,
  );
}

/** price_history rows for a hotel's room types, for the pricing-explainer card. */
export function priceHistoryForEntity(
  entityId: string,
  limit = 5,
): PriceHistoryRow[] {
  return all<PriceHistoryRow>(
    "SELECT * FROM price_history WHERE entity_id = ? ORDER BY effective_date DESC LIMIT ?",
    entityId,
    limit,
  );
}

export function splitList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}