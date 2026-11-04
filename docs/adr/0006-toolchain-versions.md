# 0006. Toolchain versions: TypeScript 6.0 and ESLint 10 with a compat shim

- Status: Accepted
- Date: 2026-11-04

## Context

As of November 2026, the latest TypeScript is 7.0 (the native compiler) and the latest ESLint is 10. `typescript-eslint`, which we need for type-aware linting, supports TypeScript `>=4.8.4 <6.1.0`. ESLint 9 is marked unsupported upstream. `eslint-plugin-jsx-a11y` (last released October 2024) declares support only up to ESLint 9.

## Decision

- Pin TypeScript to `~6.0.x`. Dependabot ignores TypeScript minor and major updates until `typescript-eslint` supports 7.
- Use ESLint 10. Load `eslint-plugin-jsx-a11y` through ESLint's official `@eslint/compat` `fixupPluginRules` shim. Its rules were verified to fire (missing `alt`, click handlers without keyboard support).
- pnpm's peer-dependency rules allow `eslint-plugin-jsx-a11y` with ESLint 10, so the install output stays clean.

## Consequences

- We stay on supported versions of the linter while keeping accessibility linting.
- Revisit when `typescript-eslint` supports TypeScript 7, or when jsx-a11y ships ESLint 10 support (then drop the shim).
