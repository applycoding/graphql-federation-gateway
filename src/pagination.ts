import { GraphQLError } from 'graphql';

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 20;

export interface PageArgs {
  first?: number | null;
  after?: string | null;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface Connection<T> {
  edges: Array<{ cursor: string; node: T }>;
  pageInfo: PageInfo;
}

export function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  if (!cursor || /[^A-Za-z0-9_-]/.test(cursor)) {
    throw new GraphQLError('Invalid cursor', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!decoded || encodeCursor(decoded) !== cursor) {
    throw new GraphQLError('Invalid cursor', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return decoded;
}

export function resolvePageSize(first: number | null | undefined): number {
  if (first == null) {
    return DEFAULT_PAGE_SIZE;
  }
  if (!Number.isInteger(first) || first < 1) {
    throw new GraphQLError('`first` must be a positive integer', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
  return Math.min(first, MAX_PAGE_SIZE);
}

export function complexityPageSize(first: unknown): number {
  if (typeof first !== 'number' || !Number.isInteger(first) || first < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(first, MAX_PAGE_SIZE);
}

export function paginate<T extends { id: string }>(
  items: readonly T[],
  args: PageArgs,
): Connection<T> {
  const pageSize = resolvePageSize(args.first);
  let start = 0;
  if (args.after) {
    const id = decodeCursor(args.after);
    const index = items.findIndex((item) => item.id === id);
    start = index === -1 ? items.length : index + 1;
  }
  const slice = items.slice(start, start + pageSize);
  const last = slice[slice.length - 1];
  return {
    edges: slice.map((node) => ({ cursor: encodeCursor(node.id), node })),
    pageInfo: {
      hasNextPage: start + pageSize < items.length,
      endCursor: last ? encodeCursor(last.id) : null,
    },
  };
}
