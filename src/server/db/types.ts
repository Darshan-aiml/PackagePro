// Row shapes for the tables of PS-04.db we read from. All money fields are
// TEXT, per rule R3 — they must never be coerced through a float.

export interface CityRow {
  city_id: string;
  name: string;
  state: string | null;
  country_code: string;
  lat: string | null;
  lng: string | null;
  region: string;
  season_profile: string;
  peak_months: string | null;
  primary_language: string;
  status: string;
}

export interface CountryRow {
  country_id: string;
  iso2: string;
  name: string;
  default_currency: string;
  region: string;
}

export interface PackageRow {
  package_id: string;
  city_id: string;
  name: string;
  theme: string;
  tier: string;
  duration_days: number;
  duration_nights: number;
  base_price: string;
  currency: string;
  min_group_size: number;
  max_group_size: number;
  difficulty: string;
  languages_offered: string;
  inclusions: string;
  exclusions: string;
  description: string;
  status: string;
}

export interface ComponentRow {
  component_id: string;
  package_id: string;
  component_type: string;
  entity_type: string | null;
  entity_id: string | null;
  day_index: number;
  slot: string;
  title: string;
  quantity: number;
  price_delta: string;
  currency: string;
  is_optional: number;
  is_swappable: number;
  swap_group: string;
}

export interface HotelRow {
  hotel_id: string;
  city_id: string;
  name: string;
  property_type: string;
  star_rating: number;
  guest_score: string | null;
  review_count: number;
  distance_to_centre_km: string | null;
  description: string;
  base_currency: string;
  chain_code: string | null;
  has_xr_scene: number;
  status: string;
}

export interface RoomTypeRow {
  room_type_id: string;
  hotel_id: string;
  name: string;
  max_occupancy: number;
  max_adults: number;
  max_children: number;
  bed_config: string;
  size_sqm: number | null;
  base_rate: string;
  currency: string;
  total_units: number;
  smoking_allowed: number;
  status: string;
}

export interface GuideRow {
  guide_id: string;
  city_id: string;
  display_name: string;
  languages: string;
  specialisation: string;
  secondary_specialisation: string | null;
  years_experience: number;
  rating: string | null;
  review_count: number;
  day_rate: string;
  half_day_rate: string;
  currency: string;
  certified: number;
  bio: string;
  status: string;
}

export interface GuideAvailabilityRow {
  availability_id: string;
  guide_id: string;
  for_date: string;
  is_available: number;
  slots_available: number;
  price_multiplier: string;
}

export interface TransferRow {
  transfer_id: string;
  city_id: string;
  from_label: string;
  to_label: string;
  mode: string;
  duration_minutes: number;
  distance_km: string | null;
  cost: string;
  currency: string;
  carbon_kg: string;
  capacity_pax: number;
  accessible: number;
  status: string;
}

export interface UserRow {
  user_id: string;
  display_name: string;
  email: string;
  home_city_id: string;
  home_currency: string;
  locale: string;
  budget_band: string;
  travel_style: string;
  traveller_type: string;
  segment: "heavy" | "light" | "cold_start";
  date_of_signup: string;
  loyalty_tier: string | null;
  status: string;
}

export interface UserPreferencesRow {
  preference_id: string;
  user_id: string;
  preferred_languages: string;
  guide_language: string | null;
  interests: string;
  dietary_flags: string | null;
  accessibility_needs: string | null;
  preferred_currency: string;
  max_daily_budget: string | null;
  pace: string;
}

export interface CurrencyRow {
  currency_id: string;
  iso4217: string;
  name: string;
  symbol: string;
  minor_unit_exponent: number;
  display_locale: string;
}

export interface LanguageRow {
  language_id: string;
  bcp47: string;
  english_name: string;
  native_name: string;
  script: string | null;
  rtl: number;
  tts_supported: number;
}

export interface PriceHistoryRow {
  history_id: string;
  entity_type: string;
  entity_id: string;
  effective_date: string;
  price: string;
  currency: string;
  demand_index: string;
  occupancy_pct: string;
  lead_time_factor: string;
  seasonality_factor: string;
  event_factor: string;
  competitor_factor: string;
  bound_clamped: number;
  explanation: string;
}