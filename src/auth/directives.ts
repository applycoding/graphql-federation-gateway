import { getDirective } from '@graphql-tools/utils';
import {
  defaultFieldResolver,
  GraphQLError,
  isObjectType,
  type GraphQLField,
  type GraphQLSchema,
} from 'graphql';
import { isRole, type AuthContext, type Role } from './types';

interface FieldRequirement {
  role?: Role;
}

function readRequirement(
  schema: GraphQLSchema,
  field: GraphQLField<unknown, AuthContext>,
): FieldRequirement | undefined {
  const roleDirective = getDirective(schema, field, 'requiresRole')?.[0];
  if (roleDirective) {
    if (!isRole(roleDirective.role)) {
      throw new Error(`@requiresRole on ${field.name} must use USER or ADMIN`);
    }
    return { role: roleDirective.role };
  }
  const authenticated = getDirective(schema, field, 'authenticated');
  if (authenticated && authenticated.length > 0) {
    return {};
  }
  return undefined;
}

function assertAuthorized(context: AuthContext | undefined, requirement: FieldRequirement): void {
  const currentUser = context?.currentUser ?? null;
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  if (requirement.role && currentUser.role !== requirement.role) {
    throw new GraphQLError(`Role ${requirement.role} is required`, {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

/**
 * Wraps field resolvers in place. Rebuilding the schema with mapSchema drops the
 * federation reference-resolver extensions that `_entities` depends on.
 */
export function applyAuthDirectives(schema: GraphQLSchema): GraphQLSchema {
  for (const type of Object.values(schema.getTypeMap())) {
    if (!isObjectType(type) || type.name.startsWith('__')) {
      continue;
    }
    for (const field of Object.values(type.getFields())) {
      const requirement = readRequirement(schema, field);
      if (!requirement) {
        continue;
      }
      const original = field.resolve ?? defaultFieldResolver;
      field.resolve = (source, args, context: AuthContext, info) => {
        assertAuthorized(context, requirement);
        return original(source, args, context, info);
      };
    }
  }
  return schema;
}
