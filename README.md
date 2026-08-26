# 108Heros Web

The 108Heros web application is the browser client for the freelance, delivery and ride marketplace. It uses Next.js, React, TypeScript and the local `108heros-client` SDK to communicate with 108Heros API.

## Development

```bash
pnpm dev
```

Open [localhost:3000](http://localhost:3000) in a browser. The application is language-routed and served below the configured locale path. API configuration must match the 108Heros environment you intend to use.

## Quality checks

```bash
pnpm lint
pnpm test:unit
pnpm test:e2e
pnpm build
```

## Product terminology

Use **108Heros** consistently in product-facing text and documentation.
