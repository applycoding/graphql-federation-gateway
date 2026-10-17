import jwt, { type SignOptions } from 'jsonwebtoken';
import { jwtSecret } from '../config';
import { isRole, type AuthUser } from './types';

export function signToken(
  user: AuthUser,
  options?: { secret?: string; expiresIn?: SignOptions['expiresIn'] },
): string {
  return jwt.sign({ sub: user.id, role: user.role }, options?.secret ?? jwtSecret(), {
    algorithm: 'HS256',
    expiresIn: options?.expiresIn ?? '8h',
  });
}

export function verifyToken(token: string, secret = jwtSecret()): AuthUser | null {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || !isRole(decoded.role)) {
      return null;
    }
    return { id: decoded.sub, role: decoded.role };
  } catch {
    return null;
  }
}

export function currentUserFromAuthorization(authorization: string | undefined): AuthUser | null {
  if (!authorization) {
    return null;
  }
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return verifyToken(token);
}
