# 108heros-client

A TypeScript HTTP client and type system for the [108heros
API](https://github.com/108-Plaza/api-108jobs).

This package is vendored into `108heros-web` at `src/lib/108heros-client` and
consumed through a `file:` dependency. It is not published to npm.

## Where it came from

It began as a fork of
[lemmy-js-client](https://github.com/LemmyNet/lemmy-js-client) — that is why
`CHANGELOG.md` records other people's releases up to the fork point, and why
some type names still read like Lemmy's. The API it speaks to is 108heros's
own; the Lemmy lineage is history rather than a dependency, and nothing here
talks to a Lemmy instance.

## Usage

```ts
import { Api108Heros } from "108heros-client";

// The base URL goes without the version — the client appends `/api/vX` itself.
const client = new Api108Heros("https://api.108heros.com");

// Bearer tokens are Identity-Platform's, not this API's: 108heros verifies
// them, it does not issue them. See `docs/` in api-108heros for the split.
client.setHeaders({ Authorization: `Bearer ${accessToken}` });
```

In the app itself, prefer the wrapper in `src/lib/api/` over constructing this
directly — it is where the ISO-fetch and error handling live.

## Development

The package builds itself: `pnpm build` (tsc) and `pnpm test` (vitest). Its
`prepare` script runs the build, which the root install triggers.

It has its **own** `package.json`, lockfile and `node_modules` — it is not a
workspace member — and it pins its own pnpm version, which differs from the
root's. Install its dependencies with `corepack pnpm install --frozen-lockfile`
from this directory rather than the pnpm on `PATH`; the root's pnpm cannot read
this lockfile and discards it silently. The two CI jobs in
`.github/workflows/ci.yml` do exactly that, and the reason is written out
there.

## OpenAPI

`pnpm tsoa` generates:

- `tsoa_build/swagger.json` — the OpenAPI document.
- `redoc-static.html` — a rendered copy of it.

Servers listed in that document come from `tsoa.json`.
