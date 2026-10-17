import { describe, expect, it } from 'vitest';
import { createOrdersByUserIdLoader } from '../src/orders/loaders';
import { OrdersStore } from '../src/orders/store';
import { createUserByIdLoader } from '../src/users/store';
import { UsersStore } from '../src/users/store';

describe('DataLoaders', () => {
  it('batches user lookups into one store read', async () => {
    const store = new UsersStore();
    const loader = createUserByIdLoader(store);
    const [ada, missing, grace] = await Promise.all([
      loader.load('user_ada'),
      loader.load('missing'),
      loader.load('user_grace'),
    ]);
    expect(ada?.name).toBe('Ada Lovelace');
    expect(missing).toBeNull();
    expect(grace?.email).toBe('grace@example.com');
    expect(store.batchCalls).toBe(1);
  });

  it('batches orders by user id and returns empty lists for users without orders', async () => {
    const store = new OrdersStore();
    const loader = createOrdersByUserIdLoader(store);
    const [ada, grace, nobody] = await Promise.all([
      loader.load('user_ada'),
      loader.load('user_grace'),
      loader.load('user_nobody'),
    ]);
    expect(ada.map((order) => order.id)).toEqual(['order_1001', 'order_1002']);
    expect(grace.map((order) => order.id)).toEqual(['order_1003', 'order_1004']);
    expect(nobody).toEqual([]);
    expect(store.batchCalls).toBe(1);
  });

  it('uses a fresh batch for a second loader', async () => {
    const store = new OrdersStore();
    await createOrdersByUserIdLoader(store).load('user_ada');
    await createOrdersByUserIdLoader(store).load('user_grace');
    expect(store.batchCalls).toBe(2);
  });
});
