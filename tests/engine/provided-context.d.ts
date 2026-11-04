import 'vitest';

declare module 'vitest' {
  export interface ProvidedContext {
    /** True on CI, where performance budgets are relaxed. */
    ci: boolean;
  }
}
