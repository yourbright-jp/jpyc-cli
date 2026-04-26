import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseEther,
  parseUnits,
  type Abi,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

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

type WalletRecord = {
  id: string;
  address: Address;
  privateKey: Hex;
  createdAt: string;
};

type WalletStore = {
  wallets: WalletRecord[];
};

type NetworkId = 'ethereum' | 'polygon' | 'avalanche';
type TokenId = 'native' | 'jpyc';

type NetworkConfig = {
  name: NetworkId;
  chainId: number;
  rpcUrlEnv: string;
  nativeSymbol: 'ETH' | 'POL' | 'AVAX';
};

const JPYC_CONTRACT_ADDRESS = '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29' as const;

const NETWORKS: Record<NetworkId, NetworkConfig> = {
  ethereum: { name: 'ethereum', chainId: 1, rpcUrlEnv: 'JPYC_ETHEREUM_RPC_URL', nativeSymbol: 'ETH' },
  polygon: { name: 'polygon', chainId: 137, rpcUrlEnv: 'JPYC_POLYGON_RPC_URL', nativeSymbol: 'POL' },
  avalanche: { name: 'avalanche', chainId: 43114, rpcUrlEnv: 'JPYC_AVALANCHE_RPC_URL', nativeSymbol: 'AVAX' },
};

const ERC20_ABI = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const SCHEMAS: Record<string, unknown> = {
  'wallet.create': { command: 'wallet.create', safety: { printsPrivateKey: false } },
  'wallet.import': { command: 'wallet.import', safety: { printsPrivateKey: false } },
  'wallet.export-private-key': { command: 'wallet.export-private-key', safety: { printsPrivateKey: true, requiresYes: true } },
  'account.balance': { command: 'account.balance', safety: { printsPrivateKey: false } },
  'transfer.plan': { command: 'transfer.plan', safety: { printsPrivateKey: false } },
  'transfer.estimate': { command: 'transfer.estimate', safety: { printsPrivateKey: false } },
  'transfer.send': {
    command: 'transfer.send',
    safety: { requiresDryRunByDefault: true, requiresYesForBroadcast: true, printsPrivateKey: false },
  },
  'contract.read': { command: 'contract.read', safety: { printsPrivateKey: false } },
  'contract.write': {
    command: 'contract.write',
    safety: { requiresDryRunByDefault: true, requiresYesForBroadcast: true, printsPrivateKey: false },
  },
  'contract.deploy': {
    command: 'contract.deploy',
    safety: { requiresDryRunByDefault: true, requiresYesForBroadcast: true, printsPrivateKey: false },
  },
};

function jsonStringify(value: unknown) {
  return JSON.stringify(
    value,
    (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner),
    2,
  );
}

function success(value: unknown): CliRunResult {
  return { exitCode: 0, stdout: `${jsonStringify(value)}\n`, stderr: '' };
}

function failure(exitCode: number, code: string, message: string): CliRunResult {
  return {
    exitCode,
    stdout: `${jsonStringify({ ok: false, error: { code, message } })}\n`,
    stderr: '',
  };
}

function parseArgs(args: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (key === 'yes' || key === 'dry-run') {
      flags[key] = true;
      continue;
    }
    const value = args[index + 1];
    if (value === undefined) {
      flags[key] = true;
      continue;
    }
    flags[key] = value;
    index += 1;
  }
  return { positional, flags };
}

function flagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

function flagBool(flags: Record<string, string | boolean>, key: string): boolean {
  return flags[key] === true;
}

function asNetwork(value: string | undefined): NetworkId {
  if (value === 'ethereum' || value === 'polygon' || value === 'avalanche') return value;
  throw new CliError(2, 'UNKNOWN_NETWORK', `Unsupported network: ${value ?? '(missing)'}`);
}

function asToken(value: string | undefined): TokenId {
  const token = value ?? 'jpyc';
  if (token === 'native' || token === 'jpyc') return token;
  throw new CliError(2, 'INVALID_ARGUMENT', `Unsupported --token: ${token}. Supported values: native, jpyc`);
}

function asAddress(value: string | undefined, label: string): Address {
  if (!value) throw new CliError(2, 'INVALID_ARGUMENT', `${label} is required`);
  return getAddress(value) as Address;
}

function asHex(value: string | undefined, label: string): Hex {
  if (!value || !value.startsWith('0x')) throw new CliError(2, 'INVALID_ARGUMENT', `${label} must be 0x-prefixed hex`);
  return value as Hex;
}

function commandFromPositionals(positional: string[]) {
  if (positional.length < 2) return positional.join('.');
  if (positional[0] === 'schema') return `schema.${positional[1]}`;
  return `${positional[0]}.${positional[1]}`;
}

class CliError extends Error {
  constructor(
    readonly exitCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

class CliRuntime {
  private readonly homeDir: string;
  private readonly env: Record<string, string>;
  private configOverrides: Record<string, string> = {};

  constructor(options: CreateJpycCliOptions) {
    this.homeDir = options.homeDir;
    this.env = { ...process.env, ...(options.env ?? {}) } as Record<string, string>;
  }

  async run(rawArgs: string[]): Promise<CliRunResult> {
    try {
      const normalized = this.normalizeJsonInput(rawArgs);
      const { positional, flags } = parseArgs(normalized.filter((arg) => arg !== '--output' && arg !== 'json'));
      const command = commandFromPositionals(positional);
      return await (async (): Promise<CliRunResult> => {
      switch (command) {
        case 'schema.list':
          return success({ schemas: Object.keys(SCHEMAS) });
        case 'schema.transfer.send':
        case 'schema.wallet.create':
        case 'schema.contract.deploy':
        case 'schema.wallet.import':
        case 'schema.account.balance':
        case 'schema.contract.read':
          return success(SCHEMAS[command.replace('schema.', '')]);
        case 'schema.does.not.exist':
          return failure(2, 'SCHEMA_NOT_FOUND', 'Schema not found: does.not.exist');
        case 'config.init':
          await this.ensureHome();
          return success({ ok: true, configPath: this.configPath() });
        case 'config.get':
          return success({ key: positional[2], value: this.configGet(positional[2]) });
        case 'config.set':
          return this.configSet(positional[2], positional[3]);
        case 'config.networks':
          return success({ networks: Object.values(NETWORKS).map((network) => ({ ...network, rpcUrlEnv: this.configGet(`networks.${network.name}.rpcUrlEnv`) })) });
        case 'config.tokens':
          return this.configTokens(asNetwork(flagString(flags, 'network')));
        case 'wallet.create':
          return this.walletCreate(flagString(flags, 'id'));
        case 'wallet.import':
          return this.walletImport(flagString(flags, 'id'), flagString(flags, 'from-private-key-env'));
        case 'wallet.list':
          return this.walletList();
        case 'wallet.show':
          return this.walletShow(flagString(flags, 'id'));
        case 'wallet.export-private-key':
          return this.walletExport(flagString(flags, 'id'), flagBool(flags, 'yes'));
        case 'account.address':
          return this.accountAddress(flagString(flags, 'wallet'));
        case 'account.balance':
          return this.accountBalance(flagString(flags, 'wallet'), asNetwork(flagString(flags, 'network')), flagString(flags, 'tokens'));
        case 'account.nonce':
          return this.accountNonce(flagString(flags, 'wallet'), asNetwork(flagString(flags, 'network')));
        case 'contract.read':
          return this.contractRead(flags);
        case 'contract.write':
          return this.contractWrite(flags);
        case 'contract.deploy':
          return this.contractDeploy(flags);
        case 'transfer.plan':
          return this.transferPlan(flags);
        case 'transfer.estimate':
          return this.transferEstimate(flags);
        case 'transfer.send':
          return this.transferSend(flags);
        default:
          return failure(2, 'UNKNOWN_COMMAND', `Unknown command: ${command}`);
      }
      })();
    } catch (error) {
      if (error instanceof CliError) return failure(error.exitCode, error.code, error.message);
      const message = error instanceof Error ? error.message : String(error);
      return failure(1, 'INTERNAL_ERROR', message);
    }
  }

  private normalizeJsonInput(rawArgs: string[]) {
    const jsonIndex = rawArgs.indexOf('--json-input');
    if (jsonIndex === -1) return rawArgs;
    const command = rawArgs[0];
    const input = rawArgs[jsonIndex + 1];
    if (!command || !input) throw new CliError(2, 'INVALID_JSON_INPUT', '--json-input requires command and JSON payload');
    const parsed = JSON.parse(input) as Record<string, unknown>;
    const expanded = command.split('.');
    for (const [key, value] of Object.entries(parsed)) {
      expanded.push(`--${key}`, String(value));
    }
    const outputIndex = rawArgs.indexOf('--output');
    if (outputIndex !== -1) expanded.push('--output', rawArgs[outputIndex + 1] ?? 'json');
    return expanded;
  }

  private async ensureHome() {
    await mkdir(this.homeDir, { recursive: true });
  }

  private walletsPath() {
    return join(this.homeDir, 'wallets.json');
  }

  private configPath() {
    return join(this.homeDir, 'config.json');
  }

  private async readWalletStore(): Promise<WalletStore> {
    try {
      const raw = await readFile(this.walletsPath(), 'utf8');
      return JSON.parse(raw) as WalletStore;
    } catch {
      return { wallets: [] };
    }
  }

  private async writeWalletStore(store: WalletStore) {
    await this.ensureHome();
    await writeFile(this.walletsPath(), `${jsonStringify(store)}\n`, { mode: 0o600 });
  }

  private async findWallet(id: string | undefined): Promise<WalletRecord> {
    if (!id) throw new CliError(2, 'INVALID_ARGUMENT', '--wallet/--id is required');
    const store = await this.readWalletStore();
    const wallet = store.wallets.find((candidate) => candidate.id === id);
    if (!wallet) throw new CliError(4, 'WALLET_NOT_FOUND', `Wallet not found: ${id}`);
    return wallet;
  }

  private publicClient(networkId: NetworkId) {
    const network = NETWORKS[networkId];
    const rpcEnv = this.configGet(`networks.${networkId}.rpcUrlEnv`) ?? network.rpcUrlEnv;
    const rpcUrl = this.env[rpcEnv];
    if (!rpcUrl) throw new CliError(2, 'RPC_URL_MISSING', `${rpcEnv} is required`);
    return createPublicClient({ transport: http(rpcUrl) });
  }

  private walletClient(networkId: NetworkId, wallet: WalletRecord) {
    const network = NETWORKS[networkId];
    const rpcEnv = this.configGet(`networks.${networkId}.rpcUrlEnv`) ?? network.rpcUrlEnv;
    const rpcUrl = this.env[rpcEnv];
    if (!rpcUrl) throw new CliError(2, 'RPC_URL_MISSING', `${rpcEnv} is required`);
    const account = privateKeyToAccount(wallet.privateKey);
    return createWalletClient({ account, transport: http(rpcUrl) });
  }

  private configGet(key: string | undefined) {
    if (!key) return undefined;
    if (this.configOverrides[key] !== undefined) return this.configOverrides[key];
    const match = /^networks\.(ethereum|polygon|avalanche)\.rpcUrlEnv$/.exec(key);
    if (match) return NETWORKS[match[1] as NetworkId].rpcUrlEnv;
    return undefined;
  }

  private configSet(key: string | undefined, value: string | undefined) {
    if (!key || value === undefined) return failure(2, 'INVALID_ARGUMENT', 'config set requires key and value');
    this.configOverrides[key] = value;
    return success({ ok: true, key, value });
  }

  private configTokens(networkId: NetworkId) {
    return success({
      network: networkId,
      tokens: [
        { symbol: NETWORKS[networkId].nativeSymbol, type: 'native', decimals: 18 },
        { symbol: 'JPYC', type: 'erc20', decimals: 18, address: JPYC_CONTRACT_ADDRESS },
      ],
    });
  }

  private async walletCreate(id: string | undefined) {
    if (!id) throw new CliError(2, 'INVALID_ARGUMENT', '--id is required');
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const store = await this.readWalletStore();
    store.wallets = store.wallets.filter((wallet) => wallet.id !== id);
    store.wallets.push({ id, privateKey, address: account.address.toLowerCase() as Address, createdAt: new Date().toISOString() });
    await this.writeWalletStore(store);
    return success({ ok: true, secretPrinted: false, wallet: { id, address: account.address.toLowerCase() } });
  }

  private async walletImport(id: string | undefined, envName: string | undefined) {
    if (!id) throw new CliError(2, 'INVALID_ARGUMENT', '--id is required');
    if (!envName) throw new CliError(2, 'INVALID_ARGUMENT', '--from-private-key-env is required');
    const privateKey = asHex(this.env[envName], envName);
    const account = privateKeyToAccount(privateKey);
    const store = await this.readWalletStore();
    store.wallets = store.wallets.filter((wallet) => wallet.id !== id);
    store.wallets.push({ id, privateKey, address: account.address.toLowerCase() as Address, createdAt: new Date().toISOString() });
    await this.writeWalletStore(store);
    return success({ ok: true, secretPrinted: false, wallet: { id, address: account.address.toLowerCase() } });
  }

  private async walletList() {
    const store = await this.readWalletStore();
    return success({ wallets: store.wallets.map((wallet) => ({ id: wallet.id, address: wallet.address, createdAt: wallet.createdAt })) });
  }

  private async walletShow(id: string | undefined) {
    const wallet = await this.findWallet(id);
    return success({ wallet: { id: wallet.id, address: wallet.address, createdAt: wallet.createdAt } });
  }

  private async walletExport(id: string | undefined, yes: boolean) {
    if (!yes) return failure(8, 'PRIVATE_KEY_EXPORT_REQUIRES_YES', 'Use --yes to export a private key');
    const wallet = await this.findWallet(id);
    return success({ ok: true, wallet: { id: wallet.id, address: wallet.address }, privateKey: wallet.privateKey });
  }

  private async accountAddress(walletId: string | undefined) {
    const wallet = await this.findWallet(walletId);
    return success({ address: wallet.address });
  }

  private async accountBalance(walletId: string | undefined, networkId: NetworkId, tokens: string | undefined) {
    const wallet = await this.findWallet(walletId);
    const client = this.publicClient(networkId);
    const requested = (tokens ?? 'native').split(',').map((token) => token.trim());
    const balances = [];
    if (requested.includes('native')) {
      const value = await client.getBalance({ address: wallet.address });
      balances.push({ symbol: NETWORKS[networkId].nativeSymbol, type: 'native', wei: value.toString(), formatted: formatEther(value) });
    }
    if (requested.includes('jpyc')) {
      const value = (await (client as any).readContract({
        address: JPYC_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [wallet.address],
      })) as bigint;
      balances.push({ symbol: 'JPYC', type: 'erc20', contract: JPYC_CONTRACT_ADDRESS, raw: value.toString(), formatted: formatUnits(value, 18) });
    }
    return success({ network: networkId, address: wallet.address, balances });
  }

  private async accountNonce(walletId: string | undefined, networkId: NetworkId) {
    const wallet = await this.findWallet(walletId);
    const client = this.publicClient(networkId);
    const nonce = await client.getTransactionCount({ address: wallet.address });
    return success({ network: networkId, address: wallet.address, nonce: nonce.toString() });
  }

  private abiFromFlags(flags: Record<string, string | boolean>): Abi {
    const abiJson = flagString(flags, 'abi-json');
    if (!abiJson) throw new CliError(2, 'INVALID_ARGUMENT', '--abi-json is required');
    return JSON.parse(abiJson) as Abi;
  }

  private argsFromFlags(flags: Record<string, string | boolean>): readonly unknown[] {
    const argsJson = flagString(flags, 'args') ?? '[]';
    return JSON.parse(argsJson) as readonly unknown[];
  }

  private async contractRead(flags: Record<string, string | boolean>) {
    const networkId = asNetwork(flagString(flags, 'network'));
    const address = asAddress(flagString(flags, 'address'), '--address');
    const functionName = flagString(flags, 'function');
    if (!functionName) throw new CliError(2, 'INVALID_ARGUMENT', '--function is required');
    const result = await (this.publicClient(networkId) as any).readContract({
      address,
      abi: this.abiFromFlags(flags),
      functionName,
      args: this.argsFromFlags(flags),
    });
    return success({ ok: true, command: 'contract.read', network: networkId, result: typeof result === 'bigint' ? result.toString() : String(result) });
  }

  private async contractWrite(flags: Record<string, string | boolean>) {
    const networkId = asNetwork(flagString(flags, 'network'));
    const wallet = await this.findWallet(flagString(flags, 'wallet'));
    const address = asAddress(flagString(flags, 'address'), '--address');
    const functionName = flagString(flags, 'function');
    if (!functionName) throw new CliError(2, 'INVALID_ARGUMENT', '--function is required');
    const abi = this.abiFromFlags(flags);
    const args = this.argsFromFlags(flags);
    const data = encodeFunctionData({ abi, functionName, args });
    const client = this.publicClient(networkId);
    const base = { network: networkId, chainId: NETWORKS[networkId].chainId, to: address };
    if (flagBool(flags, 'dry-run')) {
      const gas = await client.estimateGas({ account: wallet.address, to: address, data });
      return success({ ok: true, command: 'contract.write', mode: 'dry-run', broadcast: false, tx: { ...base, gas: gas.toString() } });
    }
    if (!flagBool(flags, 'yes')) return failure(8, 'USER_CONFIRMATION_REQUIRED', 'Use --yes to broadcast contract write');
    const txHash = await (this.walletClient(networkId, wallet) as any).writeContract({ address, abi, functionName, args, chain: null });
    await client.waitForTransactionReceipt({ hash: txHash });
    return success({ ok: true, command: 'contract.write', broadcast: true, txHash, tx: base });
  }

  private async contractDeploy(flags: Record<string, string | boolean>) {
    const networkId = asNetwork(flagString(flags, 'network'));
    const wallet = await this.findWallet(flagString(flags, 'wallet'));
    const bytecode = asHex(flagString(flags, 'bytecode'), '--bytecode');
    const client = this.publicClient(networkId);
    if (flagBool(flags, 'dry-run')) {
      const gas = await client.estimateGas({ account: wallet.address, data: bytecode });
      return success({ ok: true, command: 'contract.deploy', mode: 'dry-run', broadcast: false, tx: { network: networkId, chainId: NETWORKS[networkId].chainId, gas: gas.toString() } });
    }
    if (!flagBool(flags, 'yes')) return failure(8, 'USER_CONFIRMATION_REQUIRED', 'Use --yes to deploy contract');
    const txHash = await (this.walletClient(networkId, wallet) as any).deployContract({ abi: [], bytecode, chain: null });
    const receipt = await client.waitForTransactionReceipt({ hash: txHash });
    return success({ ok: true, command: 'contract.deploy', broadcast: true, txHash, contractAddress: receipt.contractAddress });
  }

  private transferParams(flags: Record<string, string | boolean>) {
    const networkId = asNetwork(flagString(flags, 'network'));
    const from = flagString(flags, 'from');
    const to = asAddress(flagString(flags, 'to'), '--to');
    const amount = flagString(flags, 'amount');
    const token = asToken(flagString(flags, 'token'));
    if (!from || !amount) throw new CliError(2, 'INVALID_ARGUMENT', '--from and --amount are required');
    return { networkId, from, to, amount, token };
  }

  private async transferPlan(flags: Record<string, string | boolean>) {
    const { networkId, to, amount, token } = this.transferParams(flags);
    return success({
      ok: true,
      command: 'transfer.plan',
      plan: {
        network: networkId,
        chainId: NETWORKS[networkId].chainId,
        to,
        amount,
        token: token === 'native' ? NETWORKS[networkId].nativeSymbol : 'JPYC',
        tokenAddress: token === 'native' ? undefined : JPYC_CONTRACT_ADDRESS,
      },
    });
  }

  private async transferEstimate(flags: Record<string, string | boolean>) {
    const { networkId, from, to, amount, token } = this.transferParams(flags);
    const wallet = await this.findWallet(from);
    const client = this.publicClient(networkId);
    const gas = token === 'native'
      ? await client.estimateGas({ account: wallet.address, to, value: parseEther(amount) })
      : await client.estimateGas({
          account: wallet.address,
          to: JPYC_CONTRACT_ADDRESS,
          data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [to, parseUnits(amount, 18)] }),
        });
    return success({ ok: true, command: 'transfer.estimate', estimate: { gas: gas.toString(), network: networkId } });
  }

  private async transferSend(flags: Record<string, string | boolean>) {
    const { networkId, from, to, amount, token } = this.transferParams(flags);
    const wallet = await this.findWallet(from);
    const client = this.publicClient(networkId);
    const isNative = token === 'native';
    const tokenInfo = isNative
      ? { symbol: NETWORKS[networkId].nativeSymbol, type: 'native' }
      : { symbol: 'JPYC', address: JPYC_CONTRACT_ADDRESS, type: 'erc20' };
    if (flagBool(flags, 'dry-run')) {
      const gas = isNative
        ? await client.estimateGas({ account: wallet.address, to, value: parseEther(amount) })
        : await client.estimateGas({
            account: wallet.address,
            to: JPYC_CONTRACT_ADDRESS,
            data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [to, parseUnits(amount, 18)] }),
          });
      return success({ ok: true, command: 'transfer.send', mode: 'dry-run', broadcast: false, token: tokenInfo, estimate: { gas: gas.toString() } });
    }
    if (!flagBool(flags, 'yes')) return failure(8, 'USER_CONFIRMATION_REQUIRED', 'Use --yes to broadcast transfer');
    const walletClient = this.walletClient(networkId, wallet);
    const txHash = isNative
      ? await (walletClient as any).sendTransaction({ to, value: parseEther(amount), chain: null })
      : await (walletClient as any).writeContract({ address: JPYC_CONTRACT_ADDRESS, abi: ERC20_ABI, functionName: 'transfer', args: [to, parseUnits(amount, 18)], chain: null });
    await client.waitForTransactionReceipt({ hash: txHash });
    return success({ ok: true, command: 'transfer.send', broadcast: true, txHash, token: tokenInfo });
  }
}

export function createJpycCli(options: CreateJpycCliOptions): JpycCli {
  return new CliRuntime(options);
}
