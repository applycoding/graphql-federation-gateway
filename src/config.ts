export const DEMO_JWT_SECRET = 'demo-only-not-a-secret';
export const DEMO_WEBHOOK_TOKEN = 'demo-webhook-token';

export const DEFAULT_USERS_PORT = 4101;
export const DEFAULT_ORDERS_PORT = 4102;
export const DEFAULT_GATEWAY_PORT = 4100;

export function readPort(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return port;
}

export function jwtSecret(): string {
  return process.env.JWT_SECRET || DEMO_JWT_SECRET;
}

export function webhookToken(): string {
  return process.env.WEBHOOK_TOKEN || DEMO_WEBHOOK_TOKEN;
}

export function webhookUrl(): string | undefined {
  return process.env.WEBHOOK_URL || undefined;
}

export function usersGraphqlUrl(): string {
  return process.env.USERS_URL ?? `http://127.0.0.1:${DEFAULT_USERS_PORT}/graphql`;
}

export function ordersGraphqlUrl(): string {
  return process.env.ORDERS_URL ?? `http://127.0.0.1:${DEFAULT_ORDERS_PORT}/graphql`;
}
