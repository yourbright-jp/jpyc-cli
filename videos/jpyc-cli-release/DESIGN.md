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
