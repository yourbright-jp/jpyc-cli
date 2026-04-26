export type CliRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type JpycCli = {
  run(args: string[]): Promise<CliRunResult>;
};

export type CreateJpycCliOptions = {
  homeDir: string;
  env?: Record<string, string>;
  rpc?: unknown;
  txRecorder?: { broadcasts: unknown[] };
};

export function createJpycCli(_options: CreateJpycCliOptions): JpycCli {
  return {
    async run(_args: string[]): Promise<CliRunResult> {
      throw new Error('JPYC CLI is not implemented yet');
    },
  };
}
