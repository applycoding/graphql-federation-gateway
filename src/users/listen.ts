import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import cors from 'cors';
import express from 'express';
import { DEFAULT_USERS_PORT, readPort } from '../config';
import { closeHttpServer, listen } from '../http';
import { buildUsersSchema, createUsersContext } from './schema';
import { UsersStore } from './store';

export interface RunningService {
  url: string;
  close(): Promise<void>;
}

export async function startUsersServer(port = readPort('PORT', DEFAULT_USERS_PORT)): Promise<RunningService> {
  const store = new UsersStore();
  const apollo = new ApolloServer({ schema: buildUsersSchema(store) });
  await apollo.start();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok', service: 'users' });
  });
  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: async ({ req }) =>
        createUsersContext(
          typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
          store,
        ),
    }),
  );

  const httpServer = await listen(app, port);
  return {
    url: `http://127.0.0.1:${port}/graphql`,
    async close() {
      await closeHttpServer(httpServer);
      await apollo.stop();
    },
  };
}
