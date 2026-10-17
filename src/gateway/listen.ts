import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import cors from 'cors';
import express from 'express';
import {
  DEFAULT_GATEWAY_PORT,
  ordersGraphqlUrl,
  readPort,
  usersGraphqlUrl,
  webhookToken,
} from '../config';
import { closeHttpServer, listen } from '../http';
import { demoUsers } from '../users/data';
import { signToken } from '../auth/jwt';
import { forwardAuthorization, type AuthorizationContext } from './forwardAuthorization';
import { createQueryGuardPlugin } from './guard';
import { isOrderCreatedEvent, type OrderCreatedEvent } from '../orders/webhook';

export interface RunningGateway {
  url: string;
  deliveries: OrderCreatedEvent[];
  close(): Promise<void>;
}

export async function startGatewayServer(
  port = readPort('PORT', DEFAULT_GATEWAY_PORT),
): Promise<RunningGateway> {
  const deliveries: OrderCreatedEvent[] = [];
  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: [
        { name: 'users', url: usersGraphqlUrl() },
        { name: 'orders', url: ordersGraphqlUrl() },
      ],
    }),
    serviceHealthCheck: false,
    buildService({ url }) {
      return new RemoteGraphQLDataSource<AuthorizationContext>({
        url,
        willSendRequest({ request, context }) {
          forwardAuthorization(request, context);
        },
      });
    },
  });

  const apollo = new ApolloServer<AuthorizationContext>({
    gateway,
    introspection: true,
    plugins: [createQueryGuardPlugin()],
  });
  await apollo.start();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok', service: 'gateway' });
  });
  app.post('/demo/token', (request, response) => {
    const userId = (request.body as { userId?: unknown } | undefined)?.userId;
    const user = demoUsers.find((candidate) => candidate.id === userId);
    if (!user) {
      response.status(404).json({
        error: 'Unknown demo user',
        knownUserIds: demoUsers.map((candidate) => candidate.id),
      });
      return;
    }
    response.status(200).json({
      token: signToken({ id: user.id, role: user.role }),
      user: { id: user.id, role: user.role },
    });
  });
  app.post('/demo/webhooks/orders', (request, response) => {
    if (request.get('x-webhook-token') !== webhookToken()) {
      response.status(401).json({ error: 'Invalid webhook token' });
      return;
    }
    if (!isOrderCreatedEvent(request.body)) {
      response.status(400).json({ error: 'Expected an order.created event' });
      return;
    }
    deliveries.push(request.body);
    response.status(202).json({ received: true });
  });
  app.get('/demo/webhooks/orders', (_request, response) => {
    response.status(200).json({ deliveries });
  });
  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: async ({ req }): Promise<AuthorizationContext> => ({
        authorization: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
      }),
    }),
  );

  const httpServer = await listen(app, port);
  return {
    url: `http://127.0.0.1:${port}/graphql`,
    deliveries,
    async close() {
      await closeHttpServer(httpServer);
      await apollo.stop();
    },
  };
}
