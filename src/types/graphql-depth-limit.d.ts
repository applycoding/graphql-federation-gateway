declare module 'graphql-depth-limit' {
  import type { ValidationRule } from 'graphql';

  function depthLimit(
    maxDepth: number,
    options?: {
      ignore?: Array<string | RegExp | ((fieldName: string) => boolean)>;
    },
    callback?: (depths: Record<string, number>) => void,
  ): ValidationRule;

  export default depthLimit;
}
