export type Role = "customer" | "barista" | "admin";

export function homeForRole(role: Role): string {
  return role === "admin" ? "/admin" : role === "barista" ? "/barista" : "/customer";
}
