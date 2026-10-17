import { webhookToken, webhookUrl } from '../config';
import type { OrderRecord } from './data';

export interface OrderCreatedEvent {
  id: string;
  type: 'order.created';
  createdAt: string;
  data: {
    orderId: string;
    userId: string;
    totalCents: number;
    status: OrderRecord['status'];
  };
}

export interface WebhookAttempt {
  event: OrderCreatedEvent;
  status: 'recorded' | 'delivered' | 'failed';
  detail?: string;
}

export interface FetchLike {
  (
    url: string,
    init: { method: string; headers: Record<string, string>; body: string },
  ): Promise<{ ok: boolean; status: number }>;
}

const defaultFetch: FetchLike = async (url, init) => {
  const response = await fetch(url, init);
  return { ok: response.ok, status: response.status };
};

export function orderCreatedEvent(order: OrderRecord): OrderCreatedEvent {
  return {
    id: `evt_${order.id}`,
    type: 'order.created',
    createdAt: order.createdAt,
    data: {
      orderId: order.id,
      userId: order.userId,
      totalCents: order.totalCents,
      status: order.status,
    },
  };
}

export class OrderWebhook {
  readonly attempts: WebhookAttempt[] = [];

  constructor(
    private readonly options: {
      url?: string;
      token: string;
      fetchImpl?: FetchLike;
    },
  ) {}

  async deliver(event: OrderCreatedEvent): Promise<void> {
    if (!this.options.url) {
      this.attempts.push({ event, status: 'recorded' });
      return;
    }
    try {
      const response = await (this.options.fetchImpl ?? defaultFetch)(this.options.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-token': this.options.token,
        },
        body: JSON.stringify(event),
      });
      this.attempts.push({
        event,
        status: response.ok ? 'delivered' : 'failed',
        detail: response.ok ? undefined : `HTTP ${response.status}`,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown webhook error';
      this.attempts.push({ event, status: 'failed', detail });
    }
  }
}

export function createOrderWebhookFromEnv(): OrderWebhook {
  return new OrderWebhook({
    url: webhookUrl(),
    token: webhookToken(),
  });
}

export function isOrderCreatedEvent(value: unknown): value is OrderCreatedEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const event = value as Record<string, unknown>;
  const data = event.data;
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const payload = data as Record<string, unknown>;
  return (
    event.type === 'order.created' &&
    typeof event.id === 'string' &&
    typeof event.createdAt === 'string' &&
    typeof payload.orderId === 'string' &&
    typeof payload.userId === 'string' &&
    typeof payload.totalCents === 'number' &&
    typeof payload.status === 'string'
  );
}
