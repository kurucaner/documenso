# Template copy across teams (exploration)

## Why

Operators in multi-team organisations often maintain templates on one team (e.g. a property or business unit) and need the same structure on another team without re-building PDFs and fields. Today **Duplicate** only creates a copy on the **current** team (`ctx.teamId` in `duplicateEnvelope`).

## User stories

1. **Forward (Phase 1):** On Team A’s template list, pick **Copy to team…** → choose Team B → new template on B; original stays on A.
2. **Import (Phase 2):** On Team B’s template list, **Import from team…** → choose Team A → pick a template → copy into B.

Both require the logged-in user to be a member of source and destination teams in the **same organisation** (v1).

## Existing building blocks

| Area | Location | Notes |
|------|----------|--------|
| Core copy | `packages/lib/server-only/envelope/duplicate-envelope.ts` | Creates envelope on `teamId` arg; ORGANISATION → PRIVATE when `envelope.teamId !== teamId`; title ` (copy)`; no direct link |
| TRPC duplicate | `packages/trpc/server/envelope-router/duplicate-envelope.ts` | Always uses `ctx.teamId` as destination |
| Template UI actions | `apps/remix/app/components/tables/templates-table-action-dropdown.tsx` | `canMutate` when `row.teamId === teamId`; Duplicate hidden for org-view rows |
| Org template read | `packages/lib/server-only/template/get-organisation-template-by-id.ts` | Cross-team read within org by visibility + `TemplateType.ORGANISATION` |
| Envelope read (team) | `packages/lib/server-only/envelope/get-envelope-by-id.ts` → `getEnvelopeWhereInput` | Source must be visible on **request** team only |
| Team list | `packages/trpc/server/team-router/find-teams.ts`, session `currentOrganisation.teams` | Teams user belongs to in org |
| E2E duplicate | `packages/app-tests/e2e/templates/manage-templates.spec.ts` | Reference for template flows |

## Gaps

- No `targetTeamId` on duplicate path.
- Org-view templates visible in UI but not mutable (`canMutate === false`) — forward from org tab needs org-template read path (Phase 1 stretch or Phase 2).
- Cross-team **source** read when `ctx.teamId` ≠ owning team: `getEnvelopeWhereInput` does not match other teams’ team-scoped templates; org templates need `getOrganisationTemplateById` semantics.

## Out of scope (v1)

- Cross-organisation copy.
- Move (delete source).
- Bulk copy.
- Copying direct links.
- Folder placement (destination root).