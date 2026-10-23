# Contributing

Thanks for considering a contribution.

## Development setup

```bash
npm install
cp .env.example .env.local
# Add COMPOSIO_API_KEY to .env.local
npm run dev
```

## Before submitting

- Run `npm run typecheck`
- Run `npm run build`
- Keep changes focused and documented
- Do not commit `.env.local`, `.data/`, or generated local model files

## Pull requests

- Describe the problem and the change clearly
- Include screenshots for UI changes when possible
- Add or update documentation for new behavior