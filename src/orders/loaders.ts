import DataLoader from 'dataloader';
import type { OrderRecord } from './data';
import type { OrdersStore } from './store';

export function createOrdersByUserIdLoader(
  store: OrdersStore,
): DataLoader<string, OrderRecord[]> {
  return new DataLoader(async (userIds) => {
    const orders = store.findByUserIds(userIds);
    const grouped = new Map<string, OrderRecord[]>();
    for (const userId of userIds) {
      grouped.set(userId, []);
    }
    for (const order of orders) {
      grouped.get(order.userId)?.push(order);
    }
    for (const bucket of grouped.values()) {
      bucket.sort((left, right) => left.id.localeCompare(right.id));
    }
    return userIds.map((userId) => grouped.get(userId) ?? []);
  });
}
