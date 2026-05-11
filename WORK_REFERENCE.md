# Raconteur Work Reference

Date: 2026-05-12

## Purpose
This document summarizes what was implemented so far and explains the UI/UX reasoning in simple language so it can be shared with non-technical reviewers.

## What Was Done

### 1) Framer Motion integration
- Installed `framer-motion` and confirmed it is present in dependencies.
- Existing motion usage in InviteHelper now resolves correctly:
  - `AnimatePresence` for step transitions.
  - `motion.div` for animated enter/exit between form steps.

Why this matters:
- Prevents broken imports and compile errors.
- Keeps the onboarding flow feeling smooth and modern.

### 2) InviteHelper error cleanup
- Fixed Tailwind utility diagnostics in InviteHelper by replacing bracket forms that had direct scale equivalents:
  - `z-[100]` -> `z-100`
  - `z-[110]` -> `z-110`
  - `min-h-[500px]` -> `min-h-125`
- Re-checked file diagnostics: no errors in InviteHelper after changes.

Why this matters:
- Cleaner utility usage.
- Fewer lint/build interruptions.
- Better consistency with Tailwind v4 recommendations.

### 3) Dependency and audit remediation
- Ran security remediation workflow.
- Avoided keeping force-based downgrade outcomes that pulled the app to legacy framework versions.
- Restored modern stack and stabilized with targeted overrides.

Current dependency state:
- `next`: `16.2.6`
- `react`: `19.2.6`
- `react-dom`: `19.2.6`
- `firebase-admin`: `^13.8.0` (installed in `13.x` range)
- `framer-motion`: `^12.38.0`

Security outcome:
- Added npm overrides to address transitive vulnerable packages while retaining modern framework versions:
  - `postcss`: `^8.5.10`
  - `@tootallnate/once`: `^3.0.1`
- Latest run result was `npm audit` with zero vulnerabilities.

## UI/UX Explanation (Plain Language)

### A) The flow is a guided conversation, not a long form
The InviteHelper experience is split into steps (name, email, brand, identity, philosophy, scene, preview).

Reasoning:
- Users complete one small task at a time.
- Reduces cognitive load compared to showing everything at once.
- Increases completion rate because each step feels easy.

### B) Progress is always visible
A top progress indicator shows where the user is in the onboarding flow.

Reasoning:
- Reduces uncertainty (users know how far they are from done).
- Encourages continuation, especially on mobile.

### C) Motion is functional, not decorative
Transitions between steps use fade/slide animation.

Reasoning:
- Helps users understand state change ("I moved to the next step").
- Creates continuity between screens.
- Makes the experience feel polished without slowing task completion.

### D) Strong action hierarchy
Primary actions (Continue / Generate Preview) are visually dominant. Secondary actions (Back) are lower emphasis.

Reasoning:
- Prevents decision friction.
- Guides the user toward the intended next action.

### E) Immediate validation and feedback
Buttons are disabled until required fields are filled, and upload states show success feedback.

Reasoning:
- Prevents invalid progression.
- Users understand what is missing and what succeeded.

### F) Mobile-first layout behavior
Most content is centered with constrained widths and touch-friendly controls.

Reasoning:
- Readability remains high on small screens.
- Tap targets are comfortable.
- Keeps the flow usable on phones where many users start onboarding.

## Business Value Summary
- Faster onboarding experience with fewer points of confusion.
- Cleaner technical baseline (dependency and lint stability).
- Security posture improved while preserving modern framework versions.
- Better demo-readiness for stakeholders.

## Notes for Reviewers
- This file is a reference summary of completed work so far.
- If future UI changes are made, update this document with:
  - Changed screens/components
  - User-facing behavior changes
  - Security/dependency changes
