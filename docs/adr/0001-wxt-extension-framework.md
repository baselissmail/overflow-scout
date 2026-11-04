# 0001. Use WXT as the extension framework

- Status: Accepted
- Date: 2026-11-04

## Context

The v0.1 prototype used CRXJS, a Vite plugin. We need multi-browser output (Chrome, Edge, later Firefox), packaging and store submission from CI, typed i18n, a storage wrapper, and helpers for shadow-root content UI. WXT's own comparison page marks Plasmo as near maintenance mode and CRXJS as partly maintained.

## Decision

Build v1 on WXT (`srcDir: src`), with `@wxt-dev/module-react` and `@wxt-dev/i18n`. Auto-imports are disabled (`imports: false`): every dependency is an explicit import, visible to readers, TypeScript and the boundary lint rules.

## Consequences

- The manifest is generated from `wxt.config.ts` and the entrypoints, so `manifest.json` is no longer hand-written.
- `wxt zip` and `wxt submit` cover packaging and publishing.
- We depend on a 0.x framework. Upgrades are reviewed through Dependabot PRs and e2e tests.

## Alternatives considered

- **CRXJS:** no packaging/publishing or storage/i18n helpers, and slower maintenance.
- **Plasmo:** React-first, but on an old Parcel major and in apparent maintenance mode.
