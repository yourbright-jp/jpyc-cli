#!/usr/bin/env node
import { join } from 'node:path';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createJpycCli } from './index.js';

export function resolveCliHomeDir(env: Record<string, string | undefined>) {
  if (env.JPYC_CLI_HOME) return env.JPYC_CLI_HOME;
  const home = env.HOME ?? env.USERPROFILE;
  if (!home) throw new Error('HOME or JPYC_CLI_HOME is required');
  return join(home, '.jpyc-cli');
}

export async function runCli(argv = process.argv.slice(2), env = process.env) {
  const cli = createJpycCli({
    homeDir: resolveCliHomeDir(env),
    env: Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
  });
  const result = await cli.run(argv);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result.exitCode;
}

export function isCliEntrypoint(moduleUrl: string, argvPath: string | undefined) {
  if (!argvPath) return false;
  const argvUrl = pathToFileURL(argvPath).href;
  if (moduleUrl === argvUrl) return true;
  try {
    return moduleUrl === pathToFileURL(realpathSync(argvPath)).href;
  } catch {
    return false;
  }
}

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  runCli().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
