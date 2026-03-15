# Authentication & Routing

## Purpose

Controls user entry, protected access, and role-based navigation flow.

## Main modules

- `src/pages/LoginPage.tsx`
- `src/pages/ResetPasswordPage.tsx`
- `src/pages/InviteConfirmPage.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/lib/supabase.ts`

## How it works

1. User signs in via login page and receives Supabase session.
2. Protected routes validate auth state before rendering role dashboards.
3. Invite confirmation flow finalizes invited account onboarding.
4. Session context determines whether admin/owner/manager/tenant dashboard is mounted.

## Important behavior

- API calls include auth token via `apiClient` wrapper.
- Unauthorized states redirect to login and block protected feature tabs.
