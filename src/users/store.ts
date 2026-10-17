import DataLoader from 'dataloader';
import { demoUsers, type UserRecord } from './data';

export class UsersStore {
  private readonly users: UserRecord[];
  batchCalls = 0;

  constructor(seed: readonly UserRecord[] = demoUsers) {
    this.users = seed.map((user) => ({ ...user }));
  }

  resetBatchCount(): void {
    this.batchCalls = 0;
  }

  list(): UserRecord[] {
    return [...this.users].sort((left, right) => left.id.localeCompare(right.id));
  }

  findByIds(ids: readonly string[]): Array<UserRecord | null> {
    this.batchCalls += 1;
    const byId = new Map(this.users.map((user) => [user.id, user]));
    return ids.map((id) => byId.get(id) ?? null);
  }
}

export function createUserByIdLoader(store: UsersStore): DataLoader<string, UserRecord | null> {
  return new DataLoader(async (ids) => store.findByIds(ids));
}
