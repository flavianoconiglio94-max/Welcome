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
  seated: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};
