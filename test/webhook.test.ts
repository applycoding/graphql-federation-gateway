import { describe, expect, it } from 'vitest';
import { isOrderCreatedEvent, OrderWebhook, orderCreatedEvent } from '../src/orders/webhook';
import type { OrderRecord } from '../src/orders/data';

const order: OrderRecord = {
  id: 'order_2001',
  userId: 'user_grace',
  status: 'PENDING',
  totalCents: 3200,
  createdAt: '2024-06-01T00:00:00.000Z',
};

describe('order webhooks', () => {
  it('records an event locally when no receiver is configured', async () => {
    const webhook = new OrderWebhook({ token: 'demo-webhook-token' });
    await webhook.deliver(orderCreatedEvent(order));
    expect(webhook.attempts).toEqual([
      {
        status: 'recorded',
        event: {
          id: 'evt_order_2001',
          type: 'order.created',
          createdAt: order.createdAt,
          data: {
            orderId: 'order_2001',
            userId: 'user_grace',
            totalCents: 3200,
            status: 'PENDING',
          },
        },
      },
    ]);
  });

  it('records a failed delivery when the receiver rejects the event', async () => {
    const webhook = new OrderWebhook({
      url: 'http://webhook.test/orders',
      token: 'demo-webhook-token',
      fetchImpl: async () => ({ ok: false, status: 500 }),
    });
    await webhook.deliver(orderCreatedEvent(order));
    expect(webhook.attempts[0]).toMatchObject({ status: 'failed', detail: 'HTTP 500' });
  });

  it('recognizes a well-formed order.created payload', () => {
    expect(isOrderCreatedEvent(orderCreatedEvent(order))).toBe(true);
    expect(isOrderCreatedEvent({ type: 'order.created' })).toBe(false);
    expect(isOrderCreatedEvent(null)).toBe(false);
  });
});
