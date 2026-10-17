import { describe, expect, it } from 'vitest';
import { currentUserFromAuthorization, signToken, verifyToken } from '../src/auth/jwt';
import { DEMO_JWT_SECRET } from '../src/config';
import { forwardAuthorization } from '../src/gateway/forwardAuthorization';

const ada = { id: 'user_ada', role: 'ADMIN' as const };

describe('JWT auth', () => {
  it('round-trips a bearer token', () => {
    const token = signToken(ada);
    expect(verifyToken(token)).toEqual(ada);
    expect(currentUserFromAuthorization(`Bearer ${token}`)).toEqual(ada);
  });

  it('rejects a bad signature, an expired token, and a missing bearer scheme', () => {
    const token = signToken(ada);
    expect(verifyToken(token, 'other-secret')).toBeNull();
    expect(verifyToken(signToken(ada, { expiresIn: '-1s' }))).toBeNull();
    expect(currentUserFromAuthorization(token)).toBeNull();
    expect(currentUserFromAuthorization('Basic abc')).toBeNull();
    expect(currentUserFromAuthorization(undefined)).toBeNull();
  });

  it('signs with the demo secret unless JWT_SECRET is set', () => {
    const previous = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    const token = signToken(ada);
    expect(verifyToken(token, DEMO_JWT_SECRET)).toEqual(ada);
    if (previous === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previous;
    }
  });
});

describe('authorization forwarding', () => {
  it('copies the caller authorization header onto the subgraph request', () => {
    const headers = new Map<string, string>();
    forwardAuthorization(
      { http: { headers: { set: (name, value) => headers.set(name, value) } } },
      { authorization: 'Bearer demo' },
    );
    expect(headers.get('authorization')).toBe('Bearer demo');
  });

  it('leaves the subgraph request alone when the caller is anonymous', () => {
    let called = false;
    forwardAuthorization(
      { http: { headers: { set: () => { called = true; } } } },
      {},
    );
    expect(called).toBe(false);
  });
});
