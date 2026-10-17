import { buildSubgraphSchema } from '@apollo/subgraph';
import type { GraphQLSchema } from 'graphql';
import { applyAuthDirectives } from '../auth/directives';
import { currentUserFromAuthorization } from '../auth/jwt';
import type { AuthContext } from '../auth/types';
import { paginate, type PageArgs } from '../pagination';
import { loadSchemaDocument } from '../schemaDocuments';
import { createUserByIdLoader, type UsersStore } from './store';

export interface UsersContext extends AuthContext {
  loaders: {
    userById: ReturnType<typeof createUserByIdLoader>;
  };
}

export function createUsersContext(authorization: string | undefined, store: UsersStore): UsersContext {
  return {
    currentUser: currentUserFromAuthorization(authorization),
    loaders: { userById: createUserByIdLoader(store) },
  };
}

export function buildUsersSchema(store: UsersStore): GraphQLSchema {
  const schema = buildSubgraphSchema([{
    typeDefs: loadSchemaDocument('users.graphql'),
    resolvers: {
      Query: {
        user: (_source: unknown, args: { id: string }, context: UsersContext) =>
          context.loaders.userById.load(args.id),
        users: (_source: unknown, args: PageArgs) => paginate(store.list(), args),
        me: (_source: unknown, _args: Record<string, never>, context: UsersContext) => {
          if (!context.currentUser) {
            return null;
          }
          return context.loaders.userById.load(context.currentUser.id);
        },
      },
      User: {
        __resolveReference: (reference: { id: string }, context: UsersContext) =>
          context.loaders.userById.load(reference.id),
      },
    },
  }]);
  return applyAuthDirectives(schema);
}
