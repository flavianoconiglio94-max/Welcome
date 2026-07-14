export type RestaurantPublic = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  phone: string | null;
  address: string | null;
  google_business_profile_url: string | null;
  facebook_page_url: string | null;
  instagram_handle: string | null;
  slot_interval_minutes: number;
  default_duration_minutes: number;
  min_party_size: number;
  max_party_size: number;
  booking_lead_minutes: number;
  booking_horizon_days: number;
};

export type AvailabilitySlot = {
  slot_start: string;
  slot_end: string;
  tables_available: number;
};

export type ReservationStatus =
  | "unconfirmed"
  | "pending_seat"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";

export type Reservation = {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status: ReservationStatus;
  source: string;
  cancellation_token: string;
  notes: string | null;
  table_locked: boolean;
  highlighted: boolean;
  high_chairs: number;
  strollers: number;
  allergies: string | null;
  special_occasion: string | null;
  accessible_table: boolean;
  public_notes: string | null;
  channel: string | null;
};

// Column list kept in sync with the Reservation type: use it in every
// .select() so a new column can't be silently missing from one page.
export const RESERVATION_COLUMNS =
  "id, restaurant_id, table_id, guest_name, guest_email, guest_phone, party_size, starts_at, ends_at, status, source, cancellation_token, notes, table_locked, highlighted, high_chairs, strollers, allergies, special_occasion, accessible_table, public_notes, channel";

// Optional wizard fields the restaurant can turn on/off from settings.
export type DetailOptions = {
  high_chairs: boolean;
  strollers: boolean;
  allergies: boolean;
  special_occasion: boolean;
  accessible_table: boolean;
  public_notes: boolean;
};

export const DEFAULT_DETAIL_OPTIONS: DetailOptions = {
  high_chairs: true,
  strollers: true,
  allergies: true,
  special_occasion: true,
  accessible_table: true,
  public_notes: true,
};

export const DETAIL_OPTION_LABELS: Record<keyof DetailOptions, string> = {
  high_chairs: "Seggioloni",
  strollers: "Passeggini",
  allergies: "Allergie",
  special_occasion: "Occasione speciale",
  accessible_table: "Tavolo accessibile",
  public_notes: "Note pubbliche",
};

export const SPECIAL_OCCASIONS = [
  "Compleanno",
  "Anniversario",
  "Laurea",
  "Cena di lavoro",
  "Altro",
] as const;

export const CHANNEL_LABELS: Record<string, string> = {
  phone: "Telefono",
  in_person: "Di persona",
  email: "Email",
  whatsapp: "WhatsApp",
  other: "Altro",
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  unconfirmed: "In attesa di conferma",
  pending_seat: "In attesa di essere accomodati",
  confirmed: "Confermata",
  seated: "Accomodati",
  completed: "Completata",
  cancelled: "Cancellata",
  no_show: "No-show",
};

// Which statuses staff can move a reservation to from its current status.
// Enforced again server-side in app/admin/actions.ts — this export is for
// the UI to know which action buttons to render.
export const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  unconfirmed: ["confirmed", "cancelled"],
  pending_seat: ["seated", "cancelled", "no_show"],
  confirmed: ["pending_seat", "seated", "cancelled", "no_show"],
  seated: ["completed", "confirmed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const SOURCE_LABELS: Record<string, string> = {
  web: "Online",
  google: "Google",
  facebook: "Facebook",
  admin: "Telefono / Diretta",
  thefork_import: "Import TheFork",
};

export type DiningSection = {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
};

export type DiningTable = {
  id: string;
  restaurant_id: string;
  section_id: string | null;
  label: string;
  capacity: number;
  max_capacity: number | null;
  is_active: boolean;
};

export type GuestDirectoryEntry = {
  id: string;
  restaurant_id: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  notes: string | null;
  tags: string[];
  visit_count: number;
  created_at: string;
};
