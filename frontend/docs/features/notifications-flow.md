# Notifications Flow

## Purpose

Explains how in-app and browser notifications are handled on frontend.

## Frontend touchpoints

- Role notification tabs (manager/tenant)
- `src/hooks/useBrowserNotifications.ts`
- Notification API methods in role wrappers

## Flow summary

1. Backend creates notification records on business events.
2. Frontend fetches recipient-scoped notifications.
3. User can mark read/delete single or all notifications.
4. Browser hook can poll and display native notifications for unseen unread events.

## Important behavior

- Hook persists seen IDs in local storage to avoid duplicate browser alerts.
- Polling frequency is configurable via hook options.
