import type { Role } from '../auth/types';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const demoUsers: readonly UserRecord[] = [
  { id: 'user_ada', name: 'Ada Lovelace', email: 'ada@example.com', role: 'ADMIN' },
  { id: 'user_grace', name: 'Grace Hopper', email: 'grace@example.com', role: 'USER' },
  { id: 'user_katherine', name: 'Katherine Johnson', email: 'katherine@example.com', role: 'USER' },
];
