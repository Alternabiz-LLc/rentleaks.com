/**
 * Roles.
 *
 * `renter` and `host` are the two sides of the marketplace. `admin` is the
 * founder view — it sees across every account.
 *
 * One deliberate limit on what that view contains, borrowed from the Giggster
 * admin: it shows verification STATUS and queues, never the underlying
 * documents. An identity document is collected to be matched and discarded,
 * and a product whose whole trust proposition is "we hold nothing we do not
 * need" cannot also have a screen where anyone with the role browses other
 * people's passports. Status is what an operator actually needs to work a
 * queue; the document is not.
 */

export type RoleCarrier = { role?: string | null };

/** "staff" is an employee of the business: desk access only, see lib/access.ts. */
export const ROLES = ["renter", "host", "admin", "staff"] as const;
export type Role = (typeof ROLES)[number];

export function isAdmin(user: RoleCarrier | null | undefined) {
  return !!user && user.role === "admin";
}

export function isHost(user: RoleCarrier | null | undefined) {
  return !!user && (user.role === "host" || user.role === "admin");
}

export function normaliseRole(value: string | null | undefined): Role {
  return (ROLES as readonly string[]).includes(String(value)) ? (value as Role) : "renter";
}
