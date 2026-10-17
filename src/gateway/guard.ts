import type { ApolloServerPlugin } from '@apollo/server';
import { GraphQLError, Kind, validate, type DocumentNode } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { getComplexity, simpleEstimator } from 'graphql-query-complexity';
import { complexityPageSize } from '../pagination';
import { MAX_QUERY_COMPLEXITY, MAX_QUERY_DEPTH } from './limits';

const LIST_FIELDS = new Set(['users', 'orders']);

function isIntrospectionDocument(document: DocumentNode, operationName?: string | null): boolean {
  let sawRootField = false;
  for (const definition of document.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) {
      continue;
    }
    if (operationName && definition.name?.value !== operationName) {
      continue;
    }
    for (const selection of definition.selectionSet.selections) {
      if (selection.kind !== Kind.FIELD) {
        return false;
      }
      sawRootField = true;
      if (!selection.name.value.startsWith('__')) {
        return false;
      }
    }
  }
  return sawRootField;
}

export function createQueryGuardPlugin(
  maxDepth = MAX_QUERY_DEPTH,
  maxComplexity = MAX_QUERY_COMPLEXITY,
): ApolloServerPlugin {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation({ request, document, schema }) {
          const depthErrors = validate(schema, document, [depthLimit(maxDepth)]);
          const depthError = depthErrors[0];
          if (depthError) {
            throw new GraphQLError(depthError.message, {
              extensions: { code: 'QUERY_TOO_DEEP', maxDepth },
            });
          }
          if (isIntrospectionDocument(document, request.operationName)) {
            return;
          }
          const complexity = getComplexity({
            schema,
            query: document,
            variables: request.variables,
            operationName: request.operationName ?? undefined,
            estimators: [
              ({ field, args, childComplexity }) => {
                if (!LIST_FIELDS.has(field.name)) {
                  return undefined;
                }
                return complexityPageSize(args.first) * (childComplexity + 1);
              },
              simpleEstimator({ defaultComplexity: 1 }),
            ],
          });
          if (complexity > maxComplexity) {
            throw new GraphQLError(
              `Query complexity of ${complexity} exceeds the maximum of ${maxComplexity}`,
              { extensions: { code: 'QUERY_TOO_COMPLEX', complexity, maxComplexity } },
            );
          }
        },
      };
    },
  };
}
