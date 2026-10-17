export const ORDER_STATUSES = ['PENDING', 'PAID', 'SHIPPED'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderRecord {
  id: string;
  userId: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
}

export const demoOrders: readonly OrderRecord[] = [
  {
    id: 'order_1001',
    userId: 'user_ada',
    status: 'PAID',
    totalCents: 4200,
    createdAt: '2024-01-15T10:00:00.000Z',
  },
  {
    id: 'order_1002',
    userId: 'user_ada',
    status: 'SHIPPED',
    totalCents: 1800,
    createdAt: '2024-02-02T11:00:00.000Z',
  },
  {
    id: 'order_1003',
    userId: 'user_grace',
    status: 'PENDING',
    totalCents: 2500,
    createdAt: '2024-03-04T12:00:00.000Z',
  },
  {
    id: 'order_1004',
    userId: 'user_grace',
    status: 'PAID',
    totalCents: 9900,
    createdAt: '2024-04-05T13:00:00.000Z',
  },
  {
    id: 'order_1005',
    userId: 'user_katherine',
    status: 'SHIPPED',
    totalCents: 1500,
    createdAt: '2024-05-06T14:00:00.000Z',
  },
];
