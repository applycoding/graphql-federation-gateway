import { describe, expect, it } from 'vitest';
import { composeSubgraphDocuments } from '../src/compose';

describe('supergraph composition', () => {
  it('composes the users and orders subgraphs', () => {
    const result = composeSubgraphDocuments();
    expect(result.errors).toBeUndefined();
    expect(result.supergraphSdl).toContain('type User');
    expect(result.supergraphSdl).toContain('type Order');
    expect(result.supergraphSdl).toContain('createOrder');
    expect(result.supergraphSdl).toContain('orders');
  });
});
