# Contributing

This repo uses pnpm workspaces, TypeScript, Go, and WebAssembly.

## Setup

```sh
pnpm install
pnpm build
```

## Checks

```sh
pnpm typecheck
pnpm test
pnpm build
go test ./...
```

Run Go tests from `packages/core/native`.

## Release

Use the workspace release path so workspace dependencies are rewritten for npm:

```sh
pnpm publish:packages
```

Do not publish the adapter package with direct `npm publish` from the package
directory because npm does not rewrite workspace dependency ranges.
