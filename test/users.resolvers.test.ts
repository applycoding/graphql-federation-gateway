import { graphql, type GraphQLSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { signToken } from '../src/auth/jwt';
import { buildUsersSchema, createUsersContext } from '../src/users/schema';
import { UsersStore } from '../src/users/store';

const ada = { id: 'user_ada', role: 'ADMIN' as const };
const grace = { id: 'user_grace', role: 'USER' as const };

async function query(schema: GraphQLSchema, source: string, store: UsersStore, authorization?: string) {
  return graphql({
    schema,
    source,
    contextValue: createUsersContext(authorization, store),
  });
}

describe('users resolvers', () => {
  it('lists public names and hides email until the caller is authenticated', async () => {
    const store = new UsersStore();
    const schema = buildUsersSchema(store);
    const source = `query { users(first: 10) { edges { node { id name email role } } } }`;

    const anonymous = await query(schema, source, store);
    expect(anonymous.data?.users).toMatchObject({
      edges: [
        { node: { id: 'user_ada', name: 'Ada Lovelace', email: null, role: null } },
        { node: { id: 'user_grace', name: 'Grace Hopper', email: null, role: null } },
        { node: { id: 'user_katherine', name: 'Katherine Johnson', email: null, role: null } },
      ],
    });
    expect(anonymous.errors?.length).toBeGreaterThan(0);
    expect(anonymous.errors?.every((error) => error.extensions?.code === 'UNAUTHENTICATED')).toBe(true);

    const asUser = await query(schema, source, store, `Bearer ${signToken(grace)}`);
    const graceNode = (asUser.data?.users as { edges: Array<{ node: { id: string; email: string | null; role: string | null } }> }).edges.find(
      (edge) => edge.node.id === 'user_grace',
    );
    expect(graceNode?.node.email).toBe('grace@example.com');
    expect(graceNode?.node.role).toBeNull();
    expect(asUser.errors?.every((error) => error.extensions?.code === 'FORBIDDEN')).toBe(true);

    const asAdmin = await query(schema, source, store, `Bearer ${signToken(ada)}`);
    expect(asAdmin.errors).toBeUndefined();
    const adminEdges = (asAdmin.data?.users as { edges: Array<{ node: { id: string; email: string; role: string } }> }).edges;
    expect(adminEdges.find((edge) => edge.node.id === 'user_ada')?.node).toMatchObject({
      email: 'ada@example.com',
      role: 'ADMIN',
    });
  });

  it('resolves me from the token and batches user lookups', async () => {
    const store = new UsersStore();
    const schema = buildUsersSchema(store);
    const result = await query(
      schema,
      `query {
        me { id name }
        a: user(id: "user_ada") { id }
        b: user(id: "user_grace") { id }
        c: user(id: "user_katherine") { id }
      }`,
      store,
      `Bearer ${signToken(grace)}`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.me).toEqual({ id: 'user_grace', name: 'Grace Hopper' });
    expect(store.batchCalls).toBe(1);
  });

  it('returns null for an unknown user', async () => {
    const store = new UsersStore();
    const schema = buildUsersSchema(store);
    const result = await query(schema, `query { user(id: "missing") { id } }`, store);
    expect(result.errors).toBeUndefined();
    expect(result.data?.user).toBeNull();
  });

  it('keeps federation keys in the subgraph SDL after auth wrapping', async () => {
    const schema = buildUsersSchema(new UsersStore());
    const result = await graphql({
      schema,
      source: `query { _service { sdl } }`,
    });
    const sdl = (result.data?._service as { sdl: string }).sdl;
    expect(sdl).toContain('@key(fields: "id")');
    expect(sdl).toContain('@authenticated');
    expect(sdl).toContain('@requiresRole(role: ADMIN)');
  });
});
