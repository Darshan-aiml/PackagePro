import { cookies } from "next/headers";
import { getUser } from "@/server/db/catalogue";
import type { UserRow } from "@/server/db/types";
import { COOKIE_NAME, DEFAULT_USER_ID } from "@/lib/demo";

// Server-side identity: one cookie → one of the three seeded travellers.
// Read-only; the Client UserPicker writes the cookie and refreshes.

export async function selectedUserId(): Promise<string> {
  return (await cookies()).get(COOKIE_NAME)?.value ?? DEFAULT_USER_ID;
}

export async function selectedUser(): Promise<UserRow> {
  const fallback = getUser(DEFAULT_USER_ID);
  if (!fallback) throw new Error("seed user missing from catalogue");
  return getUser(await selectedUserId()) ?? fallback;
}