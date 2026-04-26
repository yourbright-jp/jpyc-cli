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
