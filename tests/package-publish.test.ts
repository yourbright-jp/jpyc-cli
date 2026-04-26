import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('npm publish package metadata', () => {
  it('points the jpyc binary at the built CLI entrypoint', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

    expect(packageJson.private).not.toBe(true);
    expect(packageJson.bin).toEqual({ jpyc: './dist/cli/main.js' });
    expect(packageJson.scripts).toMatchObject({
      build: 'tsc -p tsconfig.build.json',
      prepublishOnly: 'npm run typecheck && npm run build',
    });
  });

  it('limits npm package contents to runtime files', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

    expect(packageJson.files).toEqual(['dist', 'README.md', 'LICENSE']);
    expect(packageJson.engines).toEqual({ node: '>=20.19.0' });
    expect(packageJson.publishConfig).toEqual({ access: 'public' });
  });

  it('ships runtime EVM dependencies as production dependencies', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

    expect(packageJson.dependencies).toHaveProperty('viem');
    expect(packageJson.devDependencies).not.toHaveProperty('viem');
  });
});
