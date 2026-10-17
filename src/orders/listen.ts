import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import cors from 'cors';
import express from 'express';
import { DEFAULT_ORDERS_PORT, readPort } from '../config';
import { closeHttpServer, listen } from '../http';
import { buildOrdersSchema, createOrdersContext } from './schema';
import { OrdersStore } from './store';
import { createOrderWebhookFromEnv } from './webhook';

export interface RunningService {
  url: string;
  close(): Promise<void>;
}

export async function startOrdersServer(
  port = readPort('PORT', DEFAULT_ORDERS_PORT),
): Promise<RunningService> {
  const store = new OrdersStore();
  const webhook = createOrderWebhookFromEnv();
  const apollo = new ApolloServer({ schema: buildOrdersSchema(store, webhook) });
  await apollo.start();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok', service: 'orders' });
  });
  app.get('/demo/webhook-deliveries', (_request, response) => {
    response.status(200).json({ deliveries: webhook.attempts });
  });
  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: async ({ req }) =>
        createOrdersContext(
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
