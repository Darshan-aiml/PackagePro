import { d, sumDecimal, toTwo } from "@/lib/money";
import {
  getPackage,
  getCity,
  listTransfers,
  listRoomTypes,
  listGuides,
  listHotels,
  listComponents,
  listPackages,
  guideFreeDates,
  splitList,
  getUser,
  getUserPreferences,
} from "@/server/db/catalogue";
import { persistItinerary } from "@/server/db/store";
import type { ComponentRow, HotelRow, PackageRow, RoomTypeRow, UserRow } from "@/server/db/types";
import { languagesMatch } from "./recommender";

// The AI planner. Deterministic, budget- and availability-constrained, and
// explainable: every item carries an explanation key + params. It never calls
// an LLM; the Gemini layer only *phrases* these same structured reasons.
//
// Constraints honoured:
//  - budget (INR): total_cost ≤ budget; overshoot steps the hotel down, then
//    drops optional lines (highest deltas first), never locked/essential ones
//  - guides: only free dates (is_available=1, slots_available ≥ 1)
//  - INR-only: package, rooms and guides are all INR so the Decimal arithmetic
//    is exact in a single currency

export interface PlanRequest {
  userId: string;
  cityId: string;
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  budgetINR: string;
  guideLanguage?: string;
  /** Optional handoff from the configurator: assemble from a kept selection. */
  selection?: { packageId: string; keptComponentIds: string[] };
}

export interface PlanItem {
  dayIndex: number;
  sortOrder: number;
  itemType: string;
  title: string;
  cost: string;
  carbonKg: string;
  durationMinutes: number;
  explanationKey: string;
  explanationParams: Record<string, string | number>;
  locked: boolean;
  entityType: string | null;
  entityId: string | null;
}

export interface PlanDay {
  index: number;
  items: PlanItem[];
}

export interface Plan {
  tripId: string;
  itineraryId: string;
  version: number;
  title: string;
  city: string;
  startDate: string;
  endDate: string;
  nights: number;
  adults: number;
  children: number;
  totalCost: string;
  currency: string;
  totalCarbonKg: string;
  totalDurationMinutes: number;
  budget: string;
  overBudget: boolean;
  warnings: { key: string; params: Record<string, string | number> }[];
  guide: { name: string; languages: string; specialisation: string; dayRate: string; usedDays: number } | null;
  hotel: { name: string; room: string; ratePerNight: string; nights: number } | null;
  days: PlanDay[];
}

// The given guide availability calendar only exists for September 2026.
export const GUIDE_WINDOW = { start: "2026-09-01", end: "2026-09-30" } as const;

export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  for (let t = new Date(from.getTime()); t <= to; t.setUTCDate(t.getUTCDate() + 1)) {
    out.push(t.toISOString().slice(0, 10));
  }
  return out;
}

export function nightsBetween(start: string, end: string): number {
  const ms = new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

const THEME_TO_GUIDE_SPEC: Record<string, string> = {
  heritage: "heritage",
  pilgrimage: "religious",
  wildlife: "wildlife",
  adventure: "trekking",
  wellness: "accessibility",
  food_trail: "food",
  honeymoon: "photography",
  family: "accessibility",
};

// --- pure, testable helpers -------------------------------------------------

/** Durations/carbon per component type, with transfer legs resolved. */
export function enrichComponent(c: ComponentRow, cityId: string): PlanItem {
  let carbon = "0.000";
  let duration = 90;
  if (c.entity_type === "transfer" && c.entity_id) {
    const tr = listTransfers(cityId).find((t) => t.transfer_id === c.entity_id);
    if (tr) {
      carbon = tr.carbon_kg;
      duration = tr.duration_minutes;
    }
  } else if (c.component_type === "poi") duration = 120;
  else if (c.component_type === "meal") duration = 60;
  else if (c.component_type === "entry_ticket") duration = 45;
  else if (c.component_type === "hotel") duration = 0;
  else if (c.component_type === "guide") duration = 360;

  return {
    dayIndex: c.day_index,
    sortOrder: 0,
    itemType: c.component_type,
    title: c.title,
    cost: c.price_delta,
    carbonKg: carbon,
    durationMinutes: duration,
    explanationKey: reasonForComponent(c.component_type),
    explanationParams: { title: c.title },
    locked: c.is_swappable === 0,
    entityType: c.entity_type,
    entityId: c.entity_id,
  };
}

function reasonForComponent(type: string): string {
  switch (type) {
    case "hotel":
      return "reason.hotel";
    case "transfer":
      return "reason.transfer";
    case "guide":
      return "reason.guide";
    case "meal":
      return "reason.meal";
    case "entry_ticket":
      return "reason.entry";
    default:
      return "reason.poi";
  }
}

export interface RoomPick {
  hotelId: string;
  hotelName: string;
  roomName: string;
  ratePerNight: string;
  nights: number;
  total: string;
  guestScore: string | null;
}

/** Cheapest INR room fitting the party, prefer a higher-rated hotel within +30%. */
export function pickRoomAndHotel(
  cityId: string,
  adults: number,
  children: number,
  nights: number,
  budget: string,
): RoomPick | null {
  const budgetNum = d(budget);
  const candidates: { hotel: HotelRow; room: RoomTypeRow; perNight: import("decimal.js").Decimal }[] = [];
  for (const hotel of listHotels(cityId, ["INR"])) {
    for (const room of listRoomTypes(hotel.hotel_id)) {
      if (room.currency !== "INR") continue;
      if (room.max_occupancy < adults + children) continue;
      if (room.max_adults < adults) continue;
      if (d(room.base_rate).lte(budgetNum.times(0.6))) {
        candidates.push({ hotel, room, perNight: d(room.base_rate) });
      }
    }
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.perNight.lt(b.perNight) ? -1 : 1);
  const cheapest = candidates[0];
  const nicer = candidates.find(
    (c) =>
      c.perNight.lte(cheapest.perNight.times(1.3)) &&
      Number(c.hotel.guest_score ?? 0) > Number(cheapest.hotel.guest_score ?? 0),
  );
  const chosen = nicer ?? cheapest;
  return {
    hotelId: chosen.hotel.hotel_id,
    hotelName: chosen.hotel.name,
    roomName: chosen.room.name,
    ratePerNight: chosen.room.base_rate,
    nights,
    total: toTwo(chosen.perNight.times(nights)),
    guestScore: chosen.hotel.guest_score,
  };
}

export interface GuidePick {
  guideId: string;
  title: string;
  languages: string;
  specialisation: string;
  dayRate: string;
  usedDays: number;
  cost: string;
}

/** First INR guide speaking the wanted language, free on every date. */
export function matchGuide(args: {
  cityId: string;
  dates: string[];
  language?: string;
  theme: string;
  preferred?: string[];
}): GuidePick | null {
  const need = args.language ? [args.language] : args.preferred ?? [];
  const spec = THEME_TO_GUIDE_SPEC[args.theme] ?? "";
  let best: { pick: GuidePick; specScore: number; costNum: number } | null = null;

  for (const g of listGuides(args.cityId).filter((g) => g.currency === "INR")) {
    const offered = splitList(g.languages);
    if (need.length > 0 && languagesMatch(need, offered).length === 0) continue;
    const free = guideFreeDates(g.guide_id, args.dates);
    if (free.some((r) => !r.available)) continue;
    const multiplier = free.reduce((acc, r) => acc.times(d(r.multiplier)), d(1));
    const cost = toTwo(d(g.day_rate).times(multiplier));
    const costNum = Number(cost);
    const specScore = g.specialisation === spec ? 1 : 0;
    if (
      !best ||
      specScore > best.specScore ||
      (specScore === best.specScore && costNum < best.costNum)
    ) {
      best = {
        pick: {
          guideId: g.guide_id,
          title: g.display_name,
          languages: g.languages,
          specialisation: g.specialisation,
          dayRate: g.day_rate,
          usedDays: free.length,
          cost,
        },
        specScore,
        costNum,
      };
    }
  }
  return best?.pick ?? null;
}

// --- main flow --------------------------------------------------------------

export function pickPackageForCity(cityId: string): PackageRow | undefined {
  return listPackages().find((p) => p.city_id === cityId && p.currency === "INR");
}

export function planFor(req: PlanRequest): Plan {
  const city = getCity(req.cityId);
  if (!city) throw new Error(`unknown city ${req.cityId}`);
  const user = getUser(req.userId);
  if (!user) throw new Error(`unknown user ${req.userId}`);
  const prefs = getUserPreferences(req.userId);

  const nights = Math.max(1, nightsBetween(req.startDate, req.endDate));
  const guideDates = dateRange(req.startDate, req.endDate).slice(0, nights);
  const warnings: Plan["warnings"] = [];

  const pkg = req.selection
    ? getPackage(req.selection.packageId)
    : pickPackageForCity(req.cityId);
  if (!pkg || pkg.currency !== "INR") {
    warnings.push({ key: "reason.noPackage", params: { city: city.name } });
    return emptyPlan(req, city.name, nights, warnings);
  }

  const lines: ComponentRow[] = (
    req.selection
      ? req.selection.keptComponentIds
          .map((id) => lineComponents(req.selection!.packageId).find((c) => c.component_id === id))
          .filter((c): c is ComponentRow => !!c)
      : lineComponents(pkg.package_id).filter((c) => c.is_optional === 0)
  ).filter((c) => c.component_type !== "hotel"); // lodging is the picked room, not a package line

  const hotel = pickRoomAndHotel(req.cityId, req.adults, req.children, nights, req.budgetINR);
  if (!hotel) warnings.push({ key: "reason.noHotel", params: { city: city.name } });

  const guide = matchGuide({
    cityId: req.cityId,
    dates: guideDates,
    language: req.guideLanguage ?? prefs?.guide_language ?? undefined,
    theme: pkg.theme,
    preferred: prefs ? splitList(prefs.preferred_languages) : [],
  });
  if (!guide && guideDates.every((dd) => dd >= GUIDE_WINDOW.start && dd <= GUIDE_WINDOW.end)) {
    warnings.push({ key: "reason.noGuide", params: { dates: guideDates.join(", ") } });
  }

  return assemble({
    req,
    cityName: city.name,
    user,
    pkg,
    lines,
    hotel,
    guide,
    nights,
    warnings,
  });
}

function assemble(input: {
  req: PlanRequest;
  cityName: string;
  user: UserRow;
  pkg: PackageRow;
  lines: ComponentRow[];
  hotel: RoomPick | null;
  guide: GuidePick | null;
  nights: number;
  warnings: Plan["warnings"];
}): Plan {
  const { req, cityName, user, pkg, lines, hotel, guide, nights, warnings } = input;
  const budget = d(req.budgetINR);

  // Build item list: hotel first, then package lines (selection-aware).
  const items0: PlanItem[] = [];
  if (hotel) {
    items0.push({
      dayIndex: 1,
      sortOrder: 0,
      itemType: "hotel",
      title: hotel.hotelName,
      cost: hotel.total,
      carbonKg: "0.000",
      durationMinutes: 0,
      explanationKey: "reason.hotel",
      explanationParams: { title: hotel.hotelName, room: hotel.roomName, nights: hotel.nights, score: hotel.guestScore ?? "—" },
      locked: true,
      entityType: "room_type",
      entityId: hotel.hotelId,
    });
  }

  items0.push(...lines.map((c, i) => ({ ...enrichComponent(c, req.cityId), sortOrder: i + 1 })));

  if (guide) {
    items0.push({
      dayIndex: 1,
      sortOrder: items0.length + 1,
      itemType: "guide",
      title: guide.title,
      cost: guide.cost,
      carbonKg: "0.000",
      durationMinutes: 360,
      explanationKey: "reason.guide",
      explanationParams: { name: guide.title, dates: req.startDate },
      locked: false,
      entityType: "guide",
      entityId: guide.guideId,
    });
  }

  // Totals & budget step-down. hotel and guide are items like everything else,
  // so the total is exactly the item sum.
  let items: PlanItem[] = items0;
  let total = sumDecimal(items.map((i) => i.cost));
  if (total.gt(budget)) {
    const droppable = items
      .filter((i) => !i.locked && i.itemType !== "hotel" && i.itemType !== "guide")
      .sort((a, b) => Number(b.cost) - Number(a.cost));
    for (const drop of droppable) {
      if (!total.gt(budget)) break;
      total = total.minus(d(drop.cost));
      items = items.filter((i) => i !== drop);
      warnings.push({ key: "reason.droppedOptional", params: { title: drop.title } });
    }
  }

  const carbon = toTwo(sumDecimal(items.map((i) => i.carbonKg)));
  const duration = items.reduce((acc, i) => acc + i.durationMinutes, 0);
  const days = daysFromItems(items, nights);

  const title = `${cityName} · ${cleanTitle(pkg.name)}`;
  const saved = persistItinerary({
    ownerUserId: user.user_id,
    originCityId: user.home_city_id,
    destinationCityId: req.cityId,
    title,
    startDate: req.startDate,
    endDate: req.endDate,
    adults: req.adults,
    children: req.children,
    tripType: "solo",
    currency: "INR",
    totalCost: total.toFixed(2),
    totalDurationMinutes: duration,
    totalCarbonKg: carbon,
    items: items.map((i) => ({
      dayIndex: i.dayIndex,
      sortOrder: i.sortOrder,
      itemType: i.itemType,
      entityType: i.entityType,
      entityId: i.entityId,
      title: i.title,
      cost: i.cost,
      carbonKg: i.carbonKg,
      durationMinutes: i.durationMinutes,
      explanation: JSON.stringify(i.explanationParams ?? {}),
      locked: i.locked,
    })),
  });

  return {
    tripId: saved.tripId,
    itineraryId: saved.itineraryId,
    version: saved.version,
    title,
    city: cityName,
    startDate: req.startDate,
    endDate: req.endDate,
    nights,
    adults: req.adults,
    children: req.children,
    totalCost: total.toFixed(2),
    currency: "INR",
    totalCarbonKg: carbon,
    totalDurationMinutes: duration,
    budget: req.budgetINR,
    overBudget: total.gt(budget),
    warnings,
    guide: guide ? { name: guide.title, languages: guide.languages, specialisation: guide.specialisation, dayRate: guide.dayRate, usedDays: guide.usedDays } : null,
    hotel: hotel ? { name: hotel.hotelName, room: hotel.roomName, ratePerNight: hotel.ratePerNight, nights: hotel.nights } : null,
    days,
  };
}

function lineComponents(packageId: string): ComponentRow[] {
  return listComponents(packageId);
}

function cleanTitle(name: string): string {
  return name.replace(/\s*—\s*\d+ Days?.*$/i, "");
}

function daysFromItems(items: PlanItem[], nights: number): Plan["days"] {
  const maxDay = Math.max(nights, ...items.map((i) => i.dayIndex));
  const days: Plan["days"] = [];
  for (let day = 1; day <= maxDay; day++) {
    days.push({
      index: day,
      items: items.filter((i) => i.dayIndex === day).sort((a, b) => a.sortOrder - b.sortOrder),
    });
  }
  return days;
}

function emptyPlan(req: PlanRequest, cityName: string, nights: number, warnings: Plan["warnings"]): Plan {
  return {
    tripId: "",
    itineraryId: "",
    version: 0,
    title: `${cityName} · Unplanned`,
    city: cityName,
    startDate: req.startDate,
    endDate: req.endDate,
    nights,
    adults: req.adults,
    children: req.children,
    totalCost: "0.00",
    currency: "INR",
    totalCarbonKg: "0.000",
    totalDurationMinutes: 0,
    budget: req.budgetINR,
    overBudget: false,
    warnings,
    guide: null,
    hotel: null,
    days: [],
  };
}