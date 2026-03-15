# Testing

## Purpose

Describes backend testing scope and how to run it.

## Current strategy

- Controller behavior unit tests (validation/error/success scenarios)
- Controller export smoke coverage to protect public function surface
- Helper utility unit tests

## Main files

- `backend/tests/controllers.unit.test.ts`
- `backend/tests/controllers.exports.test.ts`
- `backend/tests/helpers.test.ts`

## Run commands

From repository root:

```bash
npm run test:unit:all
```

Backend-only:

```bash
npm run test:unit --prefix backend
```

## Notes

- Behavior tests target high-impact controller flows and guard clauses.
- Export smoke tests give broad refactor safety across all controller modules.
