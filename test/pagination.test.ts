import { GraphQLError } from 'graphql';
import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, MAX_PAGE_SIZE, paginate } from '../src/pagination';

const items = Array.from({ length: 25 }, (_, index) => ({
  id: `item_${String(index + 1).padStart(2, '0')}`,
}));

describe('cursor pagination', () => {
  it('encodes opaque cursors and walks pages without overlap', () => {
    const first = paginate(items, { first: 2 });
    expect(first.edges.map((edge) => edge.node.id)).toEqual(['item_01', 'item_02']);
    expect(first.pageInfo.hasNextPage).toBe(true);
    expect(first.pageInfo.endCursor).not.toBe('item_02');
    expect(decodeCursor(first.edges[0].cursor)).toBe('item_01');

    const second = paginate(items, { first: 2, after: first.pageInfo.endCursor });
    expect(second.edges.map((edge) => edge.node.id)).toEqual(['item_03', 'item_04']);
  });

  it('caps the page size', () => {
    const page = paginate(items, { first: 100 });
    expect(page.edges).toHaveLength(MAX_PAGE_SIZE);
    expect(page.pageInfo.hasNextPage).toBe(true);
  });

  it('returns an empty page for an unknown but well-formed cursor', () => {
    const page = paginate(items, { after: encodeCursor('missing') });
    expect(page.edges).toEqual([]);
    expect(page.pageInfo.hasNextPage).toBe(false);
    expect(page.pageInfo.endCursor).toBeNull();
  });

  it('rejects a malformed cursor and a non-positive page size', () => {
    expect(() => decodeCursor('not a cursor')).toThrow(GraphQLError);
    expect(() => paginate(items, { first: 0 })).toThrow(GraphQLError);
  });
});
