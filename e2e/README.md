# E2E

Real-account smoke tests for the SDK against a Matrix homeserver. These are not
part of default CI because they need real accounts and durable local stores.

## Account-file runner

Most e2e tests read accounts from `e2e/.out/accounts.json`:

```json
{
  "accounts": [
    {
      "homeserverUrl": "https://example.com",
      "userId": "@user:example.com",
      "deviceId": "DEVICEID",
      "accessToken": "ACCESS_TOKEN",
      "recoveryKey": "OPTIONAL_RECOVERY_KEY",
      "loginToken": "OPTIONAL_JWT_FOR_FRESH_DEVICE_TESTS",
      "username": "stable-label"
    }
  ]
}
```

Stores are reused between runs by default to keep encrypted-history coverage
realistic.

| Env var | Effect |
| --- | --- |
| `MATRIX_E2E_OUT_DIR` | Override the default `e2e/.out` output directory |
| `MATRIX_E2E_RESET_STORES=1` | Wipe local stores before running |
| `MATRIX_E2E_FRESH_DEVICE=1` | Force fresh devices; requires `loginToken` per account |
| `MATRIX_E2E_SDK_ROOT` | Override the SDK checkout root; defaults to this repository |

Run from the repository root:

```sh
pnpm test:e2e:surface
pnpm test:e2e
```

You can also run directly inside this package:

```sh
pnpm build
pnpm --dir e2e test:surface
pnpm --dir e2e test
```

The Chat SDK adapter test needs the upstream `chat` package resolvable in Node.

## Environment runner

`pnpm test:live` uses `scripts/live-e2e.mjs` and reads credentials from
environment variables instead of `accounts.json`.

Use separate accounts for bot and peer. Reuse stores between runs unless you're
explicitly testing fresh-device behavior:

```sh
export MATRIX_HOMESERVER_URL=https://matrix.beeper.com
export MATRIX_BOT_ACCESS_TOKEN=...
export MATRIX_PEER_ACCESS_TOKEN=...
export MATRIX_BOT_RECOVERY_KEY=...
export MATRIX_PEER_RECOVERY_KEY=...
export MATRIX_LIVE_E2E_STORE_DIR=.matrix-e2e-store
```

Run from the repository root:

```sh
pnpm build
pnpm test:live -- --keep-store
```

## Coverage

- Lazy client send/fetch with no sync
- `boot()`, `whoami()`, `client.subscribe(...)` lifecycle
- `catchUp()` replay
- Encrypted messages, edits, reactions, threads, media
- Invites and auto-join, room state, account data, to-device, receipts
- Reused accounts decrypting old encrypted history
- Multi-client same-process isolation
- Chat SDK adapter in live, sync-disabled, and webhook/apply modes

Why reuse accounts: the bugs that affect production bots often involve old
encrypted rooms, old Megolm sessions, existing devices, and history pagination
across reloads. Fresh-device runs are an explicit opt-in.
