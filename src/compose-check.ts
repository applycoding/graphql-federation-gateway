import { composeSubgraphDocuments } from './compose';

const result = composeSubgraphDocuments();

if (result.errors?.length) {
  for (const error of result.errors) {
    console.error(error.message);
  }
  process.exit(1);
}

const hintCount = result.hints?.length ?? 0;
console.log(`Supergraph composition succeeded (${hintCount} hint${hintCount === 1 ? '' : 's'}).`);
if (result.hints?.length) {
  for (const hint of result.hints) {
    console.log(`${hint.definition.code}: ${hint.message}`);
  }
}
