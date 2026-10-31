# Make a little less paperwork

Thanks for helping improve Pocket PDF Workshop. The project is free, open source, and proudly vibe coded. AI-assisted contributions are welcome; contributors remain responsible for understanding their changes, checking licenses, and verifying the resulting behavior.

## Start here

Use Node.js 24, run `npm ci`, and start `npm run dev`. Read the README and feature research for supported behavior and known limits. Open an issue before proposing a large architectural change.

Keep contributions focused. Explain the user-visible problem, the result, and meaningful validation. Good areas include PDF correctness, memory usage, device layouts, accessibility, language support, and clearer help content.

## Check your work

```sh
npm test
node scripts/prepare-source.mjs
npm run build
node scripts/verify-build.mjs
npm run format
```

For PDF changes, check exported semantics and render a representative output. For reader input, check mouse, touch-friendly controls, pointer cancellation, undo/redo, and pressure fallback. Changes to cloud or account flows need a configured test project; mocked requests alone do not establish live OAuth compatibility.

## Keep the promise

- Every document feature remains available without a subscription or required login.
- Documents are processed locally unless a user explicitly chooses a cloud transfer.
- Advertising scripts do not run in private document views.
- Conversions explain their real limits. Do not label raster slides editable or claim standards compliance without validation.
- Respect reduced motion, system appearance, and small-screen use.
- Use synthetic or anonymized fixtures. Never commit private files, credentials, service-account keys, or access tokens.

Contributions are made under AGPL-3.0-or-later. Preserve dependency notices. Questions: [ramtinneshat4@gmail.com](mailto:ramtinneshat4@gmail.com).
