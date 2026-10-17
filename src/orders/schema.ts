import { buildSubgraphSchema } from '@apollo/subgraph';
import { GraphQLError, type GraphQLSchema } from 'graphql';
import { applyAuthDirectives } from '../auth/directives';
import { currentUserFromAuthorization } from '../auth/jwt';
import type { AuthContext, AuthUser } from '../auth/types';
import { paginate, type PageArgs } from '../pagination';
import { loadSchemaDocument } from '../schemaDocuments';
import type { OrderRecord } from './data';
import { createOrdersByUserIdLoader } from './loaders';
import type { OrdersStore } from './store';
import { orderCreatedEvent, type OrderWebhook } from './webhook';

const MAX_TOTAL_CENTS = 10_000_000;

export interface OrdersContext extends AuthContext {
  loaders: {
    ordersByUserId: ReturnType<typeof createOrdersByUserIdLoader>;
  };
}

export function createOrdersContext(
  authorization: string | undefined,
  store: OrdersStore,
): OrdersContext {
  return {
    currentUser: currentUserFromAuthorization(authorization),
    loaders: { ordersByUserId: createOrdersByUserIdLoader(store) },
  };
}

interface CreateOrderArgs {
  input: {
    userId: string;
    totalCents: number;
  };
}

function assertCanCreateOrder(user: AuthUser | null, userId: string): asserts user is AuthUser {
  if (!user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  switch (user.role) {
    case 'ADMIN':
      return;
    case 'USER':
      if (user.id !== userId) {
        throw new GraphQLError('Users can only create their own orders', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      return;
    default: {
      const unexpected: never = user.role;
      throw new GraphQLError(`Unhandled role ${String(unexpected)}`, {
        extensions: { code: 'FORBIDDEN' },
      });
    }
  }
}

function assertCanReadOrders(user: AuthUser | null, ownerId: string): void {
  if (!user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  switch (user.role) {
    case 'ADMIN':
      return;
    case 'USER':
      if (user.id !== ownerId) {
        throw new GraphQLError('You can only read your own orders', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      return;
    default: {
      const unexpected: never = user.role;
      throw new GraphQLError(`Unhandled role ${String(unexpected)}`, {
        extensions: { code: 'FORBIDDEN' },
      });
    }
  }
}

function assertTotalCents(totalCents: number): void {
  if (!Number.isInteger(totalCents) || totalCents < 1 || totalCents > MAX_TOTAL_CENTS) {
    throw new GraphQLError(`totalCents must be an integer from 1 to ${MAX_TOTAL_CENTS}`, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}

export function buildOrdersSchema(store: OrdersStore, webhook: OrderWebhook): GraphQLSchema {
  const schema = buildSubgraphSchema([{
    typeDefs: loadSchemaDocument('orders.graphql'),
    resolvers: {
      Query: {
        order: (_source: unknown, args: { id: string }) => store.findById(args.id),
        orders: (_source: unknown, args: PageArgs) => paginate(store.list(), args),
      },
      Mutation: {
        createOrder: async (_source: unknown, args: CreateOrderArgs, context: OrdersContext) => {
          assertCanCreateOrder(context.currentUser, args.input.userId);
          assertTotalCents(args.input.totalCents);
          if (!args.input.userId.trim()) {
            throw new GraphQLError('userId is required', { extensions: { code: 'BAD_USER_INPUT' } });
          }
          const order = store.create({
            userId: args.input.userId,
            totalCents: args.input.totalCents,
          });
          await webhook.deliver(orderCreatedEvent(order));
          return order;
        },
      },
      User: {
        __resolveReference: (reference: { id: string }) => ({ id: reference.id }),
        orders: async (parent: { id: string }, args: PageArgs, context: OrdersContext) => {
          assertCanReadOrders(context.currentUser, parent.id);
          const orders = await context.loaders.ordersByUserId.load(parent.id);
          return paginate(orders, args);
        },
      },
      Order: {
        user: (order: OrderRecord) => ({ __typename: 'User', id: order.userId }),
      },
    },
  }]);
  return applyAuthDirectives(schema);
}
