export interface AuthorizationContext {
  authorization?: string;
}

export function forwardAuthorization(
  request: { http?: { headers: { set(name: string, value: string): void } } },
  context: AuthorizationContext,
): void {
  if (!context.authorization || !request.http) {
    return;
  }
  request.http.headers.set('authorization', context.authorization);
}
