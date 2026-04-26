import { describe, expect, it } from 'vitest';

import { pathToFileURL } from 'node:url';

import { isCliEntrypoint, resolveCliHomeDir } from '../src/cli/main.js';

describe('CLI main entrypoint', () => {
  it('uses JPYC_CLI_HOME when provided', () => {
    expect(resolveCliHomeDir({ JPYC_CLI_HOME: '/tmp/jpyc-home' })).toBe('/tmp/jpyc-home');
  });

  it('falls back to a user-scoped home directory', () => {
    expect(resolveCliHomeDir({ HOME: '/home/alice' })).toBe('/home/alice/.jpyc-cli');
  });

  it('detects execution through the compiled bin path', () => {
    const binPath = '/tmp/jpyc-global/bin/jpyc';

    expect(isCliEntrypoint(pathToFileURL(binPath).href, binPath)).toBe(true);
  });
});
