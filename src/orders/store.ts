import { demoOrders, type OrderRecord, type OrderStatus } from './data';

export interface NewOrder {
  userId: string;
  totalCents: number;
  status?: OrderStatus;
  createdAt?: string;
}

export class OrdersStore {
  private readonly orders: OrderRecord[];
  private nextNumber = 2001;
  batchCalls = 0;

  constructor(seed: readonly OrderRecord[] = demoOrders) {
    this.orders = seed.map((order) => ({ ...order }));
  }

  resetBatchCount(): void {
    this.batchCalls = 0;
  }

  list(): OrderRecord[] {
    return [...this.orders].sort((left, right) => left.id.localeCompare(right.id));
  }

  findById(id: string): OrderRecord | null {
    return this.orders.find((order) => order.id === id) ?? null;
  }

  findByUserIds(userIds: readonly string[]): OrderRecord[] {
    this.batchCalls += 1;
    const wanted = new Set(userIds);
    return this.orders.filter((order) => wanted.has(order.userId));
  }

  create(input: NewOrder): OrderRecord {
    const order: OrderRecord = {
      id: `order_${this.nextNumber}`,
      userId: input.userId,
      status: input.status ?? 'PENDING',
      totalCents: input.totalCents,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    this.nextNumber += 1;
    this.orders.push(order);
    return order;
  }
}
