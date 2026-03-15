# UI System

## Purpose

Describes shared frontend UI architecture and reusable primitives.

## Main modules

- `src/components/ui/*` (buttons, inputs, modal, table pagination, skeletons)
- Role dashboard shells and tab structure
- Shared hooks (`useInView`, notification hook)
- Theme context (`src/context/ThemeContext.tsx`)

## How it works

1. Dashboards use role-specific sidebars/topbars and tab content components.
2. Shared primitives ensure consistent spacing, interaction, and loading states.
3. Theme provider controls dark/light modes and persists preference.

## Important behavior

- Pagination and skeleton components support perceived performance.
- Account/settings tabs were adjusted for stable long-text layouts.
