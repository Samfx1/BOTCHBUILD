# Phase 5 - Performance and Scalability Hardening

Phase 5 focuses on reducing hot-path latency and improving behavior under
higher traffic.

## Deliverables

- Hot read caching for projects and project updates
- Notification fan-out optimization to reduce N+1 access patterns
- API response budget instrumentation headers
- Additional database indexes for queue, notifications, and project timelines

## Caching strategy

Implemented cache utility:

- `backend/src/utils/cache.js`

Used in:

- `backend/src/modules/projects/projects.service.js`

Cached endpoints:

- project list
- project detail
- project updates timeline

Invalidation triggers:

- project creation
- project media update creation
- investment creation
- payment status transitions that can affect project funding totals

## N+1 optimization

Notification fan-out now uses batched preference/contact lookup when available.

Repository additions:

- `ensurePreferencesForUsers`
- `getPreferencesByUserIds`
- `findRecipientContactsByUserIds`

Service addition:

- `createBulkSystemNotifications`

Used by:

- project media update notifications
- investment creation notifications

## API response budgeting

Middleware:

- `backend/src/middleware/responseBudget.js`

Headers now returned on JSON responses:

- `x-response-bytes`
- `x-response-budget`
- `x-response-budget-exceeded`

## Database optimization

Migration:

- `backend/migrations/004_phase5_performance_optimizations.sql`

Adds indexes for:

- project media timeline reads
- user notification feed reads
- investor/status-based investment reads
- active queue selection
- webhook event triage
- payment transaction status recency scans

## New configuration knobs

- `CACHE_ENABLED`
- `CACHE_DEFAULT_TTL_MS`
- `CACHE_PROJECTS_TTL_MS`
- `CACHE_MAX_ENTRIES`
- `API_RESPONSE_BUDGET_BYTES`
