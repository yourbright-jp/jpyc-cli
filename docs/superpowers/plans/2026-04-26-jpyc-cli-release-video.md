# JPYC-CLI Release Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a HyperFrames HTML video composition for the approved JPYC-CLI release announcement.

**Architecture:** Create a self-contained video project under `videos/jpyc-cli-release/` with a root `index.html`, a project-local `DESIGN.md`, and a README with validation and render commands. The composition is one 1920x1080 HyperFrames root timeline with five timed scenes, light JPYC info-inspired styling, GSAP entrances, and transition overlays between scenes.

**Tech Stack:** HyperFrames HTML data attributes, GSAP timelines, CSS, Node.js 22+ for `npx hyperframes lint/inspect/preview/render`.

---

## File Structure

- Create `videos/jpyc-cli-release/DESIGN.md`: HyperFrames visual identity source, based on the approved JPYC info light/fluid direction.
- Create `videos/jpyc-cli-release/index.html`: root HyperFrames composition and all scene markup, CSS, and GSAP timeline registration.
- Create `videos/jpyc-cli-release/README.md`: local preview, lint, inspect, and render commands plus Node 22 prerequisite.
- Modify `docs/superpowers/plans/2026-04-26-jpyc-cli-release-video.md`: track task completion as implementation proceeds.

## Task 1: Project Shell and Visual Identity

**Files:**
- Create: `videos/jpyc-cli-release/DESIGN.md`
- Create: `videos/jpyc-cli-release/README.md`

- [x] **Step 1: Create the project directory**

Run:

```bash
mkdir -p videos/jpyc-cli-release
```

Expected: directory exists.

- [x] **Step 2: Write `DESIGN.md`**

Create `videos/jpyc-cli-release/DESIGN.md` with:

```markdown
# JPYC-CLI Release Video Visual Design

## Style Prompt

Light, fluid, technical release announcement using JPYC info brand cues. The canvas is airy and trustworthy, with white interface surfaces floating over a pale blue background. Blue is the primary brand signal; teal appears only as a flowing motion accent that connects agent, terminal, wallet, balance, plan, and dry-run moments.

## Colors

- Background: `#eef2ff`
- Surface: `#ffffff`
- Primary accent: `#2563eb`
- Deep accent: `#1d4ed8`
- Ink: `#0f172a`
- Muted text: `#64748b`
- Border: `#e2e8f0`
- Flow accent: `#0d9488`
- Soft flow: `#dbeafe`

## Typography

- UI and headlines: `Noto Sans JP`, `Inter`, system sans-serif.
- Terminal and JSON: `SFMono-Regular`, `Menlo`, `Consolas`, monospace.
- Headlines use 700-900 weight.
- Terminal text uses 600-700 weight for legibility.

## Motion

- Use smooth left-to-right flow to express agent-safe orchestration.
- Every scene element enters with `gsap.from()`.
- Scene transitions use blue/teal wipes or soft white cards crossing the frame.
- Ambient lines drift slowly in the background.

## What NOT to Do

- Do not use dark cyberpunk styling.
- Do not use neon purple or generic purple-blue gradients.
- Do not display private keys.
- Do not show real transaction broadcasting.
- Do not pack terminal screens with text that requires pausing to read.
```

- [x] **Step 3: Write `README.md`**

Create `videos/jpyc-cli-release/README.md` with:

```markdown
# JPYC-CLI Release Video

HyperFrames composition for the JPYC-CLI release announcement.

## Requirements

- Node.js `>=22`
- FFmpeg
- HyperFrames via `npx hyperframes`

## Validate

```bash
npx hyperframes lint .
npx hyperframes inspect . --samples 15
```

## Preview

```bash
npx hyperframes preview
```

## Render

```bash
npx hyperframes render --output renders/jpyc-cli-release.mp4 --quality standard
```
```

- [ ] **Step 4: Commit**

Run:

```bash
git add videos/jpyc-cli-release/DESIGN.md videos/jpyc-cli-release/README.md docs/superpowers/plans/2026-04-26-jpyc-cli-release-video.md
git commit -m "Add JPYC CLI release video project shell"
```

Expected: commit succeeds.

## Task 2: Static Composition Layout

**Files:**
- Create: `videos/jpyc-cli-release/index.html`

- [ ] **Step 1: Create root HyperFrames composition**

Create `videos/jpyc-cli-release/index.html` as a standalone composition with:

- `<!doctype html>`
- a root `<div id="jpyc-cli-release" data-composition-id="jpyc-cli-release" data-start="0" data-duration="38" data-track-index="0" data-width="1920" data-height="1080">`
- five `.scene` sections for the approved storyboard.
- a `<style>` block containing the full light/fluid layout.
- a GSAP script import.
- synchronous timeline registration with `window.__timelines["jpyc-cli-release"] = tl`.

The static layout must include these scene IDs:

- `scene-title`
- `scene-schema`
- `scene-wallet`
- `scene-guardrails`
- `scene-cta`

- [ ] **Step 2: Add visible scene content**

Populate the five scenes with exact approved copy:

Scene 1:

```text
JPYC-CLI
Local-first JPYC tooling
For humans and AI agents
```

Scene 2 command:

```bash
jpyc schema list --output json
```

Scene 3 commands:

```bash
jpyc wallet create --id default --output json
jpyc account balance --wallet default --network polygon --tokens native,jpyc --output json
```

Scene 4 commands:

```bash
jpyc transfer plan --network polygon --from default --to <address> --amount 1 --token jpyc --output json
jpyc transfer send --network polygon --from default --to <address> --amount 1 --token jpyc --dry-run --output json
```

Scene 5:

```text
JPYC-CLI is ready
npm install -g @yourbright/jpyc-cli
Local-first JPYC tooling for humans and agents
```

- [ ] **Step 3: Check layout manually**

Run:

```bash
sed -n '1,260p' videos/jpyc-cli-release/index.html
```

Expected: root composition, scene IDs, CSS, GSAP import, and timeline registration are present.

- [ ] **Step 4: Commit**

Run:

```bash
git add videos/jpyc-cli-release/index.html docs/superpowers/plans/2026-04-26-jpyc-cli-release-video.md
git commit -m "Add JPYC CLI release video composition"
```

Expected: commit succeeds.

## Task 3: Timeline Motion and Transitions

**Files:**
- Modify: `videos/jpyc-cli-release/index.html`

- [ ] **Step 1: Add deterministic scene timing**

Use the following timeline windows:

```text
scene-title: 0-5
scene-schema: 5-12
scene-wallet: 12-21
scene-guardrails: 21-31
scene-cta: 31-38
```

- [ ] **Step 2: Add entrance animations**

Each scene must have `gsap.from()` entrances for:

- badge/eyebrow
- headline
- subtitle/body copy
- terminal/card elements
- flow line or diagram elements

Use durations between `0.35` and `0.75` seconds, with overlapping starts.

- [ ] **Step 3: Add transitions**

Add a `.transition-wipe` element and animate it between scenes at:

```text
4.65s
11.65s
20.65s
30.65s
```

The outgoing scene must remain visible until the transition starts. Do not add non-final exit animations.

- [ ] **Step 4: Add final fade**

Only in the final scene, fade the full composition slightly after `37.2s`.

- [ ] **Step 5: Commit**

Run:

```bash
git add videos/jpyc-cli-release/index.html docs/superpowers/plans/2026-04-26-jpyc-cli-release-video.md
git commit -m "Animate JPYC CLI release video timeline"
```

Expected: commit succeeds.

## Task 4: Validation

**Files:**
- Modify: `videos/jpyc-cli-release/README.md` if validation reveals command adjustments.

- [ ] **Step 1: Check Node version**

Run:

```bash
node --version
```

Expected for HyperFrames CLI: `v22.x` or newer.

- [ ] **Step 2: Run HyperFrames lint when Node 22 is available**

Run from `videos/jpyc-cli-release`:

```bash
npx hyperframes lint .
```

Expected: no lint errors.

- [ ] **Step 3: Run HyperFrames inspect when Node 22 is available**

Run from `videos/jpyc-cli-release`:

```bash
npx hyperframes inspect . --samples 15
```

Expected: no canvas overflow or text clipping errors.

- [ ] **Step 4: Render draft when Node 22 is available**

Run from `videos/jpyc-cli-release`:

```bash
npx hyperframes render --output renders/jpyc-cli-release-draft.mp4 --quality draft
```

Expected: MP4 render completes.

- [ ] **Step 5: Commit validation fixes**

If validation required file changes, run:

```bash
git add videos/jpyc-cli-release docs/superpowers/plans/2026-04-26-jpyc-cli-release-video.md
git commit -m "Validate JPYC CLI release video"
```

Expected: commit succeeds if changes were needed; skip commit if no files changed.
