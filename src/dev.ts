import { DEFAULT_GATEWAY_PORT } from './config';
import { startGatewayServer } from './gateway/listen';
import { startOrdersServer } from './orders/listen';
import { startUsersServer } from './users/listen';

process.env.WEBHOOK_URL ??= `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/demo/webhooks/orders`;

async function main(): Promise<void> {
  const users = await startUsersServer();
  const orders = await startOrdersServer();
  const gateway = await startGatewayServer();
  console.log(`users   ${users.url}`);
  console.log(`orders  ${orders.url}`);
  console.log(`gateway ${gateway.url}`);
  console.log(`demo token endpoint http://127.0.0.1:${DEFAULT_GATEWAY_PORT}/demo/token`);

  const shutdown = () => {
    Promise.all([gateway.close(), orders.close(), users.close()]).then(
      () => process.exit(0),
      (error: unknown) => {
        console.error(error);
        process.exit(1);
      },
    );
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
