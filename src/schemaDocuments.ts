import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse, type DocumentNode } from 'graphql';

function compiledDirname(): string | undefined {
  try {
    return __dirname;
  } catch {
    return undefined;
  }
}

function schemasDirectory(): string {
  const compiledDir = compiledDirname();
  const candidates = [
    path.join(process.cwd(), 'schemas'),
    compiledDir ? path.join(compiledDir, '..', 'schemas') : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));
  const found = candidates.find((candidate) => existsSync(path.join(candidate, 'users.graphql')));
  if (!found) {
    throw new Error(`Could not find schema documents. Looked in ${candidates.join(', ')}`);
  }
  return found;
}

export function loadSchemaDocument(filename: string): DocumentNode {
  const source = readFileSync(path.join(schemasDirectory(), filename), 'utf8');
  return parse(source);
}
