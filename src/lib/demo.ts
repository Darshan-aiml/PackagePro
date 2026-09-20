// The three seeded travellers the demo cycles through. IDs are real rows in
// PS-04.db (users table). The user-picker sets a `pp_user` cookie to switch.

export const DEMO_USERS = [
  {
    id: "usr_f855344d", // Sneha Pillai — heavy
    key: "heavy",
    name: "Sneha Pillai",
    sub: "Heavy — loyal, specific tastes",
    accent: "#5b5bd6",
  },
  {
    id: "usr_aa216995", // Ananya Das — light
    key: "light",
    name: "Ananya Das",
    sub: "Light — some signals",
    accent: "#0e9f6e",
  },
  {
    id: "usr_6afe5712", // Diya Novak — cold start
    key: "cold",
    name: "Diya Novak",
    sub: "Cold start — just signed up",
    accent: "#e07a3b",
  },
] as const;

export type DemoUserKey = (typeof DEMO_USERS)[number]["key"];

export const COOKIE_NAME = "pp_user";

export const DEFAULT_USER_ID = DEMO_USERS[2].id; // cold-start first, per the demo narrative