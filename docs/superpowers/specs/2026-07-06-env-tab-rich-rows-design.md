# Rich List Rows for the Environments Tab (Collection/Folder Settings)

**Date:** 2026-07-06
**Status:** Approved
**Scope:** Aesthetics only — `src/renderer/components/container/ContainerEditor.svelte`

## Problem

The Environments sub-tab in the collection/folder settings editor is visually
flat and its default-environment control has a discoverability problem: the
star button is invisible until a row is hovered, and the "default" badge is a
faint floating text label.

## Goal

Remake the environment select + default controls as rich list rows: each row
reads as a distinct card with clear selected/default states, while keeping all
existing behavior (`toggleEnv`, `setDefault`, save flow) untouched.

## Non-Goals

- No data model, store, IPC, or logic changes.
- No changes to the `EnvironmentAssociationModal` (separate component).
- No per-environment colors (the `Environment` model has no color field).
- No changes to the search toolbar behavior.

## Design

Rows become bordered, rounded cards in a spaced vertical list (replacing flat
flush rows). All colors use existing theme tokens so light/dark themes work
automatically.

### Row anatomy

| Element | Treatment |
|---------|-----------|
| Check control | 16px, `rounded-md`. Selected: `brand-600` fill, `brand-400` border, springy scale/fade check animation. Unselected: transparent fill, `--glass-border` border. |
| Name | Selected: `text-surface-100`, medium weight. Unselected: dimmed (`text-surface-400`). |
| Selected row surface | Brand tint background (`color-mix` brand 6–8%), brand-tinted border, inset top highlight — matching the existing `ce-tab--active` treatment. |
| Default badge | Small pill: `DEFAULT` in mono uppercase, amber (`--color-warning`) tint background. Replaces the faint floating text. |
| Star button | Always visible on **selected** rows (fixes discoverability). Filled amber on the default row. On unselected rows, appears on hover only (affordance for select+make-default in one click, which `setDefault` already does). Gets its own hover ring so it reads as a separate control. |
| Hover/press | Soft tint hover on unselected rows; slightly deeper brand tint on selected rows. |

### Conventions

- Colors: `--color-brand-*`, `--color-warning`, `--glass-border`, `--tint-*` only.
- Explicit font sizes written as `calc(Npx + var(--ui-bump))` per the
  text-size preset convention.
- Svelte 5 runes; no logic edits expected.

## Testing

Visual change only. Verify by running the app (`npm run dev`) and exercising
select / deselect / set-default / unset-default in both a collection settings
tab and a folder settings tab, in dark and light themes. Existing unit tests
do not cover this markup.
