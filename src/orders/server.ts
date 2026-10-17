import { startOrdersServer } from './listen';

startOrdersServer()
  .then((running) => {
    console.log(`orders subgraph listening on ${running.url}`);
    const shutdown = () => {
      running.close().then(
        () => process.exit(0),
        (error: unknown) => {
          console.error(error);
          process.exit(1);
        },
      );
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
