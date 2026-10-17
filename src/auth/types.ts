export const ROLES = ['USER', 'ADMIN'] as const;

export type Role = (typeof ROLES)[number];

export interface AuthUser {
  id: string;
  role: Role;
}

export interface AuthContext {
  currentUser: AuthUser | null;
}

export function isRole(value: unknown): value is Role {
  return value === 'USER' || value === 'ADMIN';
}
