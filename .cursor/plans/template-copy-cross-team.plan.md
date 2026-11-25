# Template copy across teams — Implementation Plan

## Context

Operators need to copy a template onto **another team in the same organisation** without rebuilding PDFs and fields. **Duplicate** only writes to `ctx.teamId`. This plan ships **Phase 1 (Copy to team…)** first, then **Phase 2 product (Import from team…)** reusing the same mutation.

**Design defaults (no product objection required):** Menu label **Copy to team…**; team tab only for forward; success navigates to destination template editor; OpenAPI meta on new mutation.

## Related Docs

- [`../../docs/exploration/template-copy-cross-team.md`](../../docs/exploration/template-copy-cross-team.md) — codebase gaps
- [`../../docs/design/template-copy-cross-team.md`](../../docs/design/template-copy-cross-team.md) — product rules, API, UX

## Decision

| Area | Decision |
|------|----------|
| Server primitive | `copyTemplateToTeam` in lib → `duplicateEnvelope` with `contextTeamId` (read) + `targetTeamId` (write) |
| TRPC | `envelope.copyToTeam` mutation (do not overload `duplicate`) |
| Forward UI | `TemplatesTableActionDropdown` when `canMutate` |
| Import UI | Toolbar on team templates index; wizard in Phase 4 |
| Tests | Vitest on lib guards; Playwright for happy path + one TRPC unauthorized case |
| DB | None |

## Git

Create a feature branch before Phase 0 (from up-to-date `fork` — upstream integration branch for this repo):

```bash
git checkout fork
git pull
git checkout -b feat/template-copy-cross-team
```

Maintainer shorthand: `co fork` · `pull` · `co -b feat/template-copy-cross-team`

For **parallel phases** in separate worktrees, use branch suffixes (e.g. `feat/template-copy-cross-team-phase-4b`).

## Phases

### Phase 0 — Lib: cross-team copy primitive [parallelizable: no]

**Depends on:** none

**Goal:** Copy a template to a validated destination team while reading the source through the caller’s context team.

**Files (3):**

| File | Change |
|------|--------|
| `packages/lib/server-only/envelope/duplicate-envelope.ts` | Add optional `targetTeamId` (defaults to context `teamId` for existing callers); use context id in `getEnvelopeWhereInput`; persist `targetTeamId` on create; keep org→private coercion using source vs target team ids |
| `packages/lib/server-only/envelope/copy-template-to-team.ts` | **New** — validate `EnvelopeType.TEMPLATE`, load dest via `getTeamById`, assert same `organisationId`, reject `targetTeamId === sourceTeamId` when source owned by context team; call `duplicateEnvelope` |
| `packages/lib/server-only/envelope/copy-template-to-team.test.ts` | **New** — vitest with prisma mocks: same-org success path, cross-org `UNAUTHORIZED`, not-found source, non-template `INVALID_REQUEST` |

**Tasks:**

- [x] Refactor `DuplicateEnvelopeOptions` to name `teamId` as read context (or add `targetTeamId` alongside without breaking call sites)
- [x] Implement `copyTemplateToTeam({ id, userId, contextTeamId, targetTeamId, requestMetadata, overrides? })`
- [x] Unit tests cover guard rails without full DB integration

**Done when:**

- [x] `cd packages/lib && bun test server-only/envelope/copy-template-to-team.test.ts` passes
- [x] `bun run typecheck --filter @documenso/lib` passes
- [x] Existing `duplicateEnvelope` callers unchanged (same-team duplicate behavior)

**Standalone prompt:** Implement Phase 0 of `.cursor/plans/template-copy-cross-team.plan.md`. Extend `duplicate-envelope.ts` so create `teamId` can differ from read context when `targetTeamId` is set. Add `copy-template-to-team.ts` with org/membership/template-type checks and colocated vitest mocks. Do not add TRPC or UI yet.

---

### Phase 1 — TRPC `envelope.copyToTeam` [parallelizable: no]

**Depends on:** Phase 0

**Goal:** Expose the lib function to Remix with OpenAPI meta and Zod types matching duplicate options.

**Files (3):**

| File | Change |
|------|--------|
| `packages/trpc/server/envelope-router/copy-to-team.types.ts` | **New** — `ZCopyTemplateToTeamRequestSchema` / response; OpenAPI POST `/envelope/copy-to-team` |
| `packages/trpc/server/envelope-router/copy-to-team.ts` | **New** — `authenticatedProcedure` mutation; `ctx.teamId` as context; log `envelopeId` + `targetTeamId` |
| `packages/trpc/server/envelope-router/router.ts` | Register `copyToTeam: copyToTeamRoute` |

**Tasks:**

- [x] Mirror optional `includeRecipients` / `includeFields` / `includeContents` defaults from duplicate
- [x] Return `{ id: string }` only (same as duplicate response shape)

**Done when:**

- [x] `bun run typecheck --filter @documenso/trpc` passes
- [x] Manual or `trpcQuery` from app-tests: copy between two teams in one org returns new id
- [x] Request with foreign org `targetTeamId` returns error (not 500)

**Standalone prompt:** Implement Phase 1 of `.cursor/plans/template-copy-cross-team.plan.md`. Add `copy-to-team.ts` + `.types.ts` under envelope-router and wire into `router.ts`. Call `copyTemplateToTeam` from lib with `contextTeamId = ctx.teamId`.

---

### Phase 2 — Remix: Copy to team dialog + menu [parallelizable: no]

**Depends on:** Phase 1

**Goal:** Team template row action opens team picker and copies to selected team.

**Files (2):**

| File | Change |
|------|--------|
| `apps/remix/app/components/dialogs/template-copy-to-team-dialog.tsx` | **New** — `Select` from `useCurrentOrganisation().teams` excluding current team; fieldset disabled while pending; success toast; navigate to `/t/{destUrl}/templates/{id}/edit` |
| `apps/remix/app/components/tables/templates-table-action-dropdown.tsx` | Add menu item **Copy to team…** (distinct icon from Direct link); only under `canMutate` |

**Tasks:**

- [x] Empty state when no other teams in org (disable submit)
- [x] Primary button label includes selected team name
- [x] Lingui strings for title, description, errors

**Done when:**

- [x] `bun run typecheck --filter @documenso/remix` passes
- [x] Manual: two teams same org → copy → lands on destination editor
- [x] Duplicate menu item still works unchanged

**Standalone prompt:** Implement Phase 2 of `.cursor/plans/template-copy-cross-team.plan.md`. Add `TemplateCopyToTeamDialog` and wire it into `templates-table-action-dropdown.tsx` for mutable team templates. Use `trpc.envelope.copyToTeam` and navigate to destination team after success.

---

### Phase 3 — E2E: forward happy path + API guard [parallelizable: no]

**Depends on:** Phase 2

**Goal:** Automated coverage for cross-team copy and one negative TRPC case.

**Files (1):**

| File | Change |
|------|--------|
| `packages/app-tests/e2e/templates/template-copy-to-team.spec.ts` | **New** — UI happy path (`createTeam` for team2); `trpcQuery` negative cross-org `targetTeamId` in same file (pattern from `organisation-templates.spec.ts`) |

**Tasks:**

- [x] `data-testid` on dialog submit or stable role/name selectors
- [x] Run with `CI=true`

**Done when:**

- [ ] `CI=true bun run test:dev --filter '@documenso/app-tests' -- e2e/templates/template-copy-to-team.spec.ts` passes
- [x] Negative: `targetTeamId` for team in another org rejected

**Standalone prompt:** Implement Phase 3 of `.cursor/plans/template-copy-cross-team.plan.md`. Add Playwright spec seeding two teams in one org, exercise Copy to team UI, verify template on destination. Add one trpc negative for cross-org target in the same file.

---

### Phase 4a — Import: list importable templates (lib) [parallelizable: no]

**Depends on:** Phase 0

**Goal:** Server query returns templates the user may copy from a chosen source team into current context.

**Files (3):**

| File | Change |
|------|--------|
| `packages/lib/server-only/template/find-importable-templates.ts` | **New** — assert user member of `sourceTeamId`; list team templates (same filters as `findTemplates` subset) plus org templates visible to context team per `findOrganisationTemplates` rules scoped to source team ownership |
| `packages/lib/server-only/envelope/copy-template-to-team.ts` | Extend source read: if `getEnvelopeWhereInput` misses, allow org template via `getOrganisationTemplateById` semantics (Phase 2 product) |
| `packages/lib/server-only/template/find-importable-templates.test.ts` | **New** — vitest for query shape / guard when not member of source team |

**Tasks:**

- [x] Pagination `page` / `perPage` / optional `query`
- [x] Return lite rows: `envelopeId`, `title`, `teamId`, `templateType`

**Done when:**

- [x] Vitest passes for find-importable module
- [x] Typecheck lib package green

**Standalone prompt:** Implement Phase 4a of `.cursor/plans/template-copy-cross-team.plan.md`. Add `find-importable-templates.ts` and extend `copy-template-to-team.ts` for org-template source reads. Vitest guards only.

---

### Phase 4b — Import: TRPC query [parallelizable: yes]

**Depends on:** Phase 4a

**Goal:** `template.findImportableTemplates` for import wizard step 2.

**Files (3):**

| File | Change |
|------|--------|
| `packages/trpc/server/template-router/find-importable-templates.types.ts` | **New** — request/response Zod + OpenAPI GET |
| `packages/trpc/server/template-router/find-importable-templates.ts` | **New** — wire lib; `ctx.teamId` = destination context |
| `packages/trpc/server/template-router/router.ts` | Register `findImportableTemplates` |

**Tasks:**

- [x] OpenAPI GET only (Documenso convention)

**Done when:**

- [x] Typecheck trpc green
- [x] `trpcQuery` from team B context with `sourceTeamId: A` returns seeded template

**Standalone prompt:** Implement Phase 4b of `.cursor/plans/template-copy-cross-team.plan.md`. Add template-router find-importable route + types and register on router.

---

### Phase 4c — Import: wizard UI [parallelizable: no]

**Depends on:** Phase 4b, Phase 2 (mutation UX patterns)

**Goal:** Team templates page offers **Import from team…** (team view only).

**Files (3):**

| File | Change |
|------|--------|
| `apps/remix/app/components/dialogs/template-import-from-team-dialog.tsx` | **New** — steps: pick source team (≠ current) → searchable list via `findImportableTemplates` → confirm → `copyToTeam` with `targetTeamId = currentTeam.id` |
| `apps/remix/app/routes/_authenticated+/t.$teamUrl+/templates._index.tsx` | Toolbar button when not org view |

**Tasks:**

- [ ] Disable wizard on organisation-wide view filter
- [ ] Invalidate `findTemplatesInternal` on success

**Done when:**

- [ ] Manual import from team A while on team B works without row action on A
- [ ] Remix typecheck passes

**Standalone prompt:** Implement Phase 4c of `.cursor/plans/template-copy-cross-team.plan.md`. Add multi-step import dialog and entry button on team templates index (not org view). Reuse `envelope.copyToTeam`.

---

### Phase 4d — E2E: import flow [parallelizable: no]

**Depends on:** Phase 4c

**Goal:** Playwright covers import wizard end-to-end.

**Files (1):**

| File | Change |
|------|--------|
| `packages/app-tests/e2e/templates/template-import-from-team.spec.ts` | **New** — two teams, template on A, user on B imports, list count on B increases |

**Tasks:**

- [ ] Reuse `createTeam` pattern from `organisation-templates.spec.ts`

**Done when:**

- [ ] Import E2E passes in CI
- [ ] Phase 1 forward E2E still green

**Standalone prompt:** Implement Phase 4d of `.cursor/plans/template-copy-cross-team.plan.md`. Add Playwright spec for Import from team wizard only.

---

## Parallelization summary

| Phases | Notes |
|--------|--------|
| **0 → 1 → 2 → 3** | Forward track — serial |
| **4a** | Can start after **0** (parallel with 1–3 if second agent) |
| **4b** | After 4a; can overlap with Phase 3 if disjoint owners |
| **4c → 4d** | Serial after 4b |

Suggested first ship: complete **Phases 0–3**, release forward, then **4a–4d** as a follow-up PR.

## Checks (before merge)

```bash
bun run lint
bun run typecheck --filter @documenso/lib
bun run typecheck --filter @documenso/trpc
bun run typecheck --filter @documenso/remix
CI=true bun run test:dev --filter '@documenso/app-tests' -- e2e/templates/template-copy-to-team.spec.ts
```

## Open Questions

None blocking — design **(Recommended)** answers apply for implementation.