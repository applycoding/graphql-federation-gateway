import { graphql, type GraphQLSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { signToken } from '../src/auth/jwt';
import { encodeCursor } from '../src/pagination';
import { buildOrdersSchema, createOrdersContext } from '../src/orders/schema';
import { OrdersStore } from '../src/orders/store';
import { OrderWebhook } from '../src/orders/webhook';

const ada = { id: 'user_ada', role: 'ADMIN' as const };
const grace = { id: 'user_grace', role: 'USER' as const };

function setup() {
  const store = new OrdersStore();
  const webhook = new OrderWebhook({ token: 'demo-webhook-token' });
  const schema = buildOrdersSchema(store, webhook);
  return { store, webhook, schema };
}

async function query(
  schema: GraphQLSchema,
  store: OrdersStore,
  source: string,
  authorization?: string,
  variables?: Record<string, unknown>,
) {
  return graphql({
    schema,
    source,
    variableValues: variables,
    contextValue: createOrdersContext(authorization, store),
  });
}

describe('orders resolvers', () => {
  it('paginates orders with cursors', async () => {
    const { schema, store } = setup();
    const first = await query(schema, store, `query { orders(first: 2) { edges { node { id } } pageInfo { hasNextPage endCursor } } }`);
    expect(first.errors).toBeUndefined();
    const page = first.data?.orders as {
      edges: Array<{ node: { id: string } }>;
      pageInfo: { hasNextPage: boolean; endCursor: string };
    };
    expect(page.edges.map((edge) => edge.node.id)).toEqual(['order_1001', 'order_1002']);
    expect(page.pageInfo.hasNextPage).toBe(true);

    const second = await query(
      schema,
      store,
      `query Next($after: String) { orders(first: 2, after: $after) { edges { node { id } } pageInfo { hasNextPage } } }`,
      undefined,
      { after: page.pageInfo.endCursor },
    );
    expect(second.errors).toBeUndefined();
    expect(second.data?.orders).toMatchObject({
      edges: [{ node: { id: 'order_1003' } }, { node: { id: 'order_1004' } }],
      pageInfo: { hasNextPage: true },
    });
    expect(page.pageInfo.endCursor).toBe(encodeCursor('order_1002'));
  });

  it('lets a user create only their own order and records a webhook', async () => {
    const calls: Array<{ url: string; body: string; token?: string }> = [];
    const store = new OrdersStore();
    const webhook = new OrderWebhook({
      url: 'http://webhook.test/orders',
      token: 'demo-webhook-token',
      fetchImpl: async (url, init) => {
        calls.push({ url, body: init.body, token: init.headers['x-webhook-token'] });
        return { ok: true, status: 202 };
      },
    });
    const schema = buildOrdersSchema(store, webhook);
    const source = `mutation Create($input: CreateOrderInput!) {
      createOrder(input: $input) { id status totalCents user { id } }
    }`;

    const denied = await query(schema, store, source, `Bearer ${signToken(grace)}`, {
      input: { userId: 'user_ada', totalCents: 500 },
    });
    expect(denied.data).toBeNull();
    expect(denied.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    expect(calls).toHaveLength(0);

    const created = await query(schema, store, source, `Bearer ${signToken(grace)}`, {
      input: { userId: 'user_grace', totalCents: 3200 },
    });
    expect(created.errors).toBeUndefined();
    expect(created.data?.createOrder).toMatchObject({
      id: 'order_2001',
      status: 'PENDING',
      totalCents: 3200,
      user: { id: 'user_grace' },
    });
    expect(webhook.attempts).toEqual([
      expect.objectContaining({
        status: 'delivered',
        event: expect.objectContaining({
          type: 'order.created',
          data: expect.objectContaining({ orderId: 'order_2001', userId: 'user_grace', totalCents: 3200 }),
        }),
      }),
    ]);
    expect(calls[0]).toMatchObject({ url: 'http://webhook.test/orders', token: 'demo-webhook-token' });
    expect(JSON.parse(calls[0].body)).toMatchObject({ type: 'order.created' });
  });

  it('lets an admin create an order for someone else and keeps the order when delivery fails', async () => {
    const store = new OrdersStore();
    const webhook = new OrderWebhook({
      url: 'http://webhook.test/orders',
      token: 'demo-webhook-token',
      fetchImpl: async () => {
        throw new Error('receiver down');
      },
    });
    const schema = buildOrdersSchema(store, webhook);
    const result = await query(
      schema,
      store,
      `mutation { createOrder(input: { userId: "user_katherine", totalCents: 700 }) { id } }`,
      `Bearer ${signToken(ada)}`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.createOrder).toEqual({ id: 'order_2001' });
    expect(webhook.attempts[0]).toMatchObject({ status: 'failed', detail: 'receiver down' });
  });

  it('rejects anonymous creates and non-positive totals', async () => {
    const { schema, store, webhook } = setup();
    const anonymous = await query(
      schema,
      store,
      `mutation { createOrder(input: { userId: "user_grace", totalCents: 100 }) { id } }`,
    );
    expect(anonymous.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');

    const invalid = await query(
      schema,
      store,
      `mutation { createOrder(input: { userId: "user_grace", totalCents: 0 }) { id } }`,
      `Bearer ${signToken(grace)}`,
    );
    expect(invalid.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    expect(webhook.attempts).toHaveLength(0);
  });

  it('batches entity order lookups and hides another user history', async () => {
    const { schema, store } = setup();
    const source = `query History($reps: [_Any!]!) {
      _entities(representations: $reps) {
        ... on User {
          id
          orders(first: 10) { edges { node { id } } }
        }
      }
    }`;
    const representations = [
      { __typename: 'User', id: 'user_ada' },
      { __typename: 'User', id: 'user_grace' },
    ];

    const asAdmin = await query(schema, store, source, `Bearer ${signToken(ada)}`, { reps: representations });
    expect(asAdmin.errors).toBeUndefined();
    expect(asAdmin.data?._entities).toMatchObject([
      { id: 'user_ada', orders: { edges: [{ node: { id: 'order_1001' } }, { node: { id: 'order_1002' } }] } },
      { id: 'user_grace', orders: { edges: [{ node: { id: 'order_1003' } }, { node: { id: 'order_1004' } }] } },
    ]);
    expect(store.batchCalls).toBe(1);

    store.resetBatchCount();
    const asGrace = await query(schema, store, source, `Bearer ${signToken(grace)}`, { reps: representations });
    const entities = asGrace.data?._entities as Array<{ id: string; orders: { edges: unknown[] } | null }>;
    expect(entities[0]).toMatchObject({ id: 'user_ada', orders: null });
    expect(entities[1]?.orders).toMatchObject({
      edges: [{ node: { id: 'order_1003' } }, { node: { id: 'order_1004' } }],
    });
    expect(asGrace.errors?.map((error) => error.extensions?.code)).toEqual(['FORBIDDEN']);
    expect(store.batchCalls).toBe(1);
  });
});
