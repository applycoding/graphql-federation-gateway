import { composeServices, type CompositionResult } from '@apollo/composition';
import { loadSchemaDocument } from './schemaDocuments';

export function composeSubgraphDocuments(): CompositionResult {
  return composeServices([
    {
      name: 'users',
      url: 'http://users:4101/graphql',
      typeDefs: loadSchemaDocument('users.graphql'),
    },
    {
      name: 'orders',
      url: 'http://orders:4102/graphql',
      typeDefs: loadSchemaDocument('orders.graphql'),
    },
  ]);
}
