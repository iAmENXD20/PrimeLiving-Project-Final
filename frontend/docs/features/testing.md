# Testing

## Purpose

Describes frontend testing approach and where coverage currently exists.

## Current strategy

- Unit tests for utility and API client behavior
- Export smoke tests for major frontend API/hook/context modules
- Vitest configured with `jsdom` environment

## Main files

- `frontend/tests/utils.test.ts`
- `frontend/tests/apiClient.behavior.test.ts`
- `frontend/tests/frontend-exports.test.ts`

## Run commands

From repository root:

```bash
npm run test:unit:all
```

Frontend-only:

```bash
npm run test:unit --prefix frontend
```

## Notes

- Behavior tests currently focus on API wrapper correctness (cache/auth/error handling).
- Smoke suite ensures exported frontend feature APIs remain present during refactors.
