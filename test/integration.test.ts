import type { ApolloServer } from '@apollo/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signToken } from '../src/auth/jwt';
import type { AuthorizationContext } from '../src/gateway/forwardAuthorization';
import { createInProcessServer } from '../src/gateway/inProcess';
import { MAX_QUERY_COMPLEXITY, MAX_QUERY_DEPTH } from '../src/gateway/limits';
import { OrdersStore } from '../src/orders/store';
import { OrderWebhook } from '../src/orders/webhook';
import { UsersStore } from '../src/users/store';

const ada = { id: 'user_ada', role: 'ADMIN' as const };
const grace = { id: 'user_grace', role: 'USER' as const };

function bearer(user: { id: string; role: 'USER' | 'ADMIN' }): AuthorizationContext {
  return { authorization: `Bearer ${signToken(user)}` };
}

async function execute(
  server: ApolloServer<AuthorizationContext>,
  source: string,
  contextValue: AuthorizationContext = {},
  variables?: Record<string, unknown>,
) {
  const response = await server.executeOperation({ query: source, variables }, { contextValue });
  if (response.body.kind !== 'single') {
    throw new Error(`Expected a single result, received ${response.body.kind}`);
  }
  return response.body.singleResult;
}

describe('composed supergraph', () => {
  const users = new UsersStore();
  const orders = new OrdersStore();
  const webhook = new OrderWebhook({ token: 'demo-webhook-token' });
  let server: ApolloServer<AuthorizationContext>;

  beforeAll(async () => {
    server = await createInProcessServer({ users, orders, webhook });
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  it('resolves order owners from the users subgraph', async () => {
    const result = await execute(
      server,
      `query {
        orders(first: 1) {
          edges { node { id totalCents user { id name } } }
        }
      }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.orders).toEqual({
      edges: [{ node: { id: 'order_1001', totalCents: 4200, user: { id: 'user_ada', name: 'Ada Lovelace' } } }],
    });
  });

  it('hides email across the entity boundary until the caller authenticates', async () => {
    const result = await execute(
      server,
      `query { order(id: "order_1003") { user { name email } } }`,
    );
    expect(result.data?.order).toMatchObject({ user: { name: 'Grace Hopper', email: null } });
    expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');

    const authed = await execute(
      server,
      `query { order(id: "order_1003") { user { email role } } }`,
      bearer(grace),
    );
    expect(authed.data?.order).toMatchObject({ user: { email: 'grace@example.com', role: null } });
    expect(authed.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('batches User.orders across the supergraph for an admin', async () => {
    orders.resetBatchCount();
    const result = await execute(
      server,
      `query {
        users(first: 10) {
          edges {
            node {
              id
              orders(first: 10) { edges { node { id } } }
            }
          }
        }
      }`,
      bearer(ada),
    );
    expect(result.errors).toBeUndefined();
    const edges = (result.data?.users as { edges: Array<{ node: { id: string; orders: { edges: unknown[] } } }> }).edges;
    expect(edges).toHaveLength(3);
    expect(edges.find((edge) => edge.node.id === 'user_katherine')?.node.orders.edges).toEqual([
      { node: { id: 'order_1005' } },
    ]);
    expect(orders.batchCalls).toBe(1);
  });

  it('rejects a nested query past the depth limit and allows a shallower one', async () => {
    let selection = 'id';
    const cycles = Math.ceil(MAX_QUERY_DEPTH / 4) + 1;
    for (let index = 0; index < cycles; index += 1) {
      selection = `orders(first: 1) { edges { node { user { ${selection} } } } }`;
    }
    const tooDeep = await execute(server, `query TooDeep { users(first: 1) { edges { node { ${selection} } } } }`, bearer(ada));
    expect(tooDeep.errors?.[0]?.extensions?.code).toBe('QUERY_TOO_DEEP');
    expect(tooDeep.errors?.[0]?.message).toContain('maximum operation depth');

    const shallow = await execute(
      server,
      `query {
        users(first: 1) {
          edges { node { id name orders(first: 1) { edges { node { id user { name } } } } } }
        }
      }`,
      bearer(ada),
    );
    expect(shallow.errors).toBeUndefined();
    expect(shallow.data?.users).toMatchObject({
      edges: [{ node: { id: 'user_ada', name: 'Ada Lovelace' } }],
    });
  });

  it('rejects a query over the complexity limit', async () => {
    const wide = `users(first: 20) { edges { node { orders(first: 20) { edges { node { id status totalCents user { id name email } } } } } } }`;
    const result = await execute(server, `query TooWide { a: ${wide} b: ${wide} }`, bearer(ada));
    expect(result.errors?.[0]?.extensions?.code).toBe('QUERY_TOO_COMPLEX');
    const complexity = result.errors?.[0]?.extensions?.complexity;
    expect(typeof complexity).toBe('number');
    expect(complexity as number).toBeGreaterThan(MAX_QUERY_COMPLEXITY);
  });

  it('still allows introspection', async () => {
    const result = await execute(server, `query { __typename }`);
    expect(result.errors).toBeUndefined();
    expect(result.data?.__typename).toBe('Query');
  });

  it('creates an order through the gateway and emits order.created', async () => {
    const before = webhook.attempts.length;
    const result = await execute(
      server,
      `mutation { createOrder(input: { userId: "user_grace", totalCents: 2750 }) { id status user { name } } }`,
      bearer(grace),
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.createOrder).toMatchObject({
      status: 'PENDING',
      user: { name: 'Grace Hopper' },
    });
    expect(webhook.attempts.slice(before)).toEqual([
      expect.objectContaining({
        status: 'recorded',
        event: expect.objectContaining({
          type: 'order.created',
          data: expect.objectContaining({ userId: 'user_grace', totalCents: 2750 }),
        }),
      }),
    ]);
  });
});
