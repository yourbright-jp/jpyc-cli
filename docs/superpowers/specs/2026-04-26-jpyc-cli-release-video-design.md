# JPYC-CLI Release Video Design

## Summary

Create a 30-40 second 1920x1080 HyperFrames release announcement video for JPYC-CLI.

The approved direction is **Flowing Agent Demo**: a light, fluid narrative showing an AI agent safely using JPYC-CLI through schemas, local wallet checks, transfer planning, and dry-run guardrails.

## Goals

- Announce JPYC-CLI as local-first command-line tooling for JPYC.
- Show that humans and AI agents can use the same safe command surface.
- Emphasize JSON output, dry runs, local wallet control, and explicit confirmation before broadcasts.
- Keep the video understandable without requiring prior JPYC-CLI knowledge.

## Audience

- Developers evaluating JPYC-CLI.
- AI-agent users who want a safe CLI surface for JPYC workflows.
- JPYC ecosystem users who need a concise release overview.

## Visual Identity

Use JPYC info brand cues from `https://jpyc-info.com/`.

- Mood: fluid, light, technical, trustworthy.
- Canvas: light.
- Background: `#eef2ff`.
- Surface: `#ffffff`.
- Primary accent: `#2563eb`.
- Ink: `#0f172a`.
- Muted text: `#64748b`.
- Border: `#e2e8f0`.
- Flow accent: teal `#0d9488`.
- Typography: `Noto Sans JP`, `Inter`, system sans for UI text; system monospace for terminal and JSON.

Avoid dark cyberpunk styling, neon-heavy palettes, generic purple gradients, or dense command screens that require pausing to read.

## Narrative Arc

The video follows one agent-safe workflow:

1. JPYC-CLI is released.
2. An AI agent checks the command surface through schema output.
3. The agent creates or selects a local wallet and checks account state.
4. The agent plans a JPYC transfer.
5. The dry-run guardrail appears before any broadcast.
6. The video closes with the install command and release message.

## Storyboard

### Scene 1: Release Title, 0-5s

Show a clean JPYC-CLI release title over a light JPYC info-inspired canvas. Soft blue and teal flow lines move behind white UI surfaces.

Primary copy:

- `JPYC-CLI`
- `Local-first JPYC tooling`
- `For humans and AI agents`

### Scene 2: Agent Reads the Command Surface, 5-12s

Show an AI agent node connected to a terminal card. The terminal reveals schema-oriented usage.

Representative command:

```bash
jpyc schema list --output json
```

Message:

- `JSON-first commands`
- `Predictable for scripts and agents`

### Scene 3: Local Wallet and Account Checks, 12-21s

Show wallet and balance cards flowing left to right. Keep private-key handling implicit and safe; do not display private keys.

Representative commands:

```bash
jpyc wallet create --id default --output json
jpyc account balance --wallet default --network polygon --tokens native,jpyc --output json
```

Message:

- `Local wallet control`
- `No private keys printed by default`

### Scene 4: Plan and Dry-Run Guardrails, 21-31s

Show a transfer path from agent to CLI to JPYC. The plan appears first, then dry-run appears as a visible safety gate before sending.

Representative commands:

```bash
jpyc transfer plan --network polygon --from default --to <address> --amount 1 --token jpyc --output json
jpyc transfer send --network polygon --from default --to <address> --amount 1 --token jpyc --dry-run --output json
```

Message:

- `Plan before send`
- `Dry-run before broadcast`
- `Broadcast requires explicit confirmation`

### Scene 5: Install CTA, 31-38s

Close with a calm release CTA and install command.

Primary copy:

- `JPYC-CLI is ready`
- `npm install -g @yourbright/jpyc-cli`
- `Local-first JPYC tooling for humans and agents`

## HyperFrames Implementation

- Use a single root HyperFrames composition at 1920x1080.
- Use HTML/CSS as the layout source of truth, then add GSAP `from()` entrances.
- Use scene transitions between all scenes; no jump cuts.
- Use fluid line and card motion to connect the agent, terminal, wallet, balance, plan, and dry-run moments.
- Register all timelines synchronously with `window.__timelines`.
- Do not use random or time-based animation logic.
- Do not animate clip dimensions directly.

## Validation

Before rendering final video:

- Run `npx hyperframes lint`.
- Run `npx hyperframes inspect --samples 15`.
- Preview locally with `npx hyperframes preview`.
- Render a draft MP4 first.
- Render final MP4 at standard or high quality after visual checks pass.

## Out of Scope

- Real transaction broadcasting in the video.
- Displaying private keys.
- Live RPC calls or captured terminal recordings.
- Voiceover for the initial video.
- Vertical or square social variants for the initial video.
