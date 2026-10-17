import { ApolloGateway } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { graphql, type GraphQLSchema } from 'graphql';
import { composeSubgraphDocuments } from '../compose';
import { buildOrdersSchema, createOrdersContext } from '../orders/schema';
import type { OrdersStore } from '../orders/store';
import type { OrderWebhook } from '../orders/webhook';
import { buildUsersSchema, createUsersContext } from '../users/schema';
import type { UsersStore } from '../users/store';
import type { AuthorizationContext } from './forwardAuthorization';
import { createQueryGuardPlugin } from './guard';

interface SubgraphRequest {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string | null;
}

/**
 * Executes a subgraph schema in-process and builds that subgraph's own context
 * from the caller's Authorization header, matching the HTTP servers.
 */
class InProcessSubgraph {
  constructor(
    private readonly schema: GraphQLSchema,
    private readonly contextFor: (authorization: string | undefined) => object,
  ) {}

  async process(options: { request: SubgraphRequest; context?: AuthorizationContext }) {
    return graphql({
      schema: this.schema,
      source: options.request.query ?? '',
      variableValues: options.request.variables,
      operationName: options.request.operationName ?? undefined,
      contextValue: this.contextFor(options.context?.authorization),
    });
  }
}

export async function createInProcessServer(deps: {
  users: UsersStore;
  orders: OrdersStore;
  webhook: OrderWebhook;
}): Promise<ApolloServer<AuthorizationContext>> {
  const composed = composeSubgraphDocuments();
  if (!composed.supergraphSdl) {
    const message = composed.errors?.map((error) => error.message).join('\n') ?? 'composition failed';
    throw new Error(message);
  }

  const usersSchema = buildUsersSchema(deps.users);
  const ordersSchema = buildOrdersSchema(deps.orders, deps.webhook);
  const subgraphs: Record<string, InProcessSubgraph> = {
    users: new InProcessSubgraph(usersSchema, (authorization) => createUsersContext(authorization, deps.users)),
    orders: new InProcessSubgraph(ordersSchema, (authorization) => createOrdersContext(authorization, deps.orders)),
  };

  const gateway = new ApolloGateway({
    supergraphSdl: composed.supergraphSdl,
    serviceHealthCheck: false,
    buildService({ name }) {
      const subgraph = subgraphs[name];
      if (!subgraph) {
        throw new Error(`No in-process schema for subgraph ${name}`);
      }
      return subgraph;
    },
  });

  const server = new ApolloServer<AuthorizationContext>({
    gateway,
    introspection: true,
    plugins: [createQueryGuardPlugin()],
  });
  await server.start();
  return server;
}
