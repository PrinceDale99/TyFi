// Shared helpers for the week 4 testnet scripts: stellar CLI calls, admin
// multisig signatures, and a tx log that maps every step to Stellar Expert.
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Keypair } from '@stellar/stellar-sdk';

export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', '..');
export const NET = ['--network', 'testnet'];
export const VAULT = 'CARODUWJWUBI5UPKQCAVGT7GXKJN65ZDVEOPSYCWPBGC6F5MYQJXCQZR';
export const DAO = 'CB3A3IZMHF7EUM75CP5FFA6XZNABLRZAT5JL6XC4SZX3FWGRVMQM6KPY';
export const XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
export const explorerTx = (hash) => `https://stellar.expert/explorer/testnet/tx/${hash}`;

export function stellar(args, { quiet = false } = {}) {
  return execFileSync('stellar', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', quiet ? 'pipe' : 'inherit'] }).trim();
}

export function addressOf(identity) {
  return stellar(['keys', 'address', identity], { quiet: true });
}

export function secretOf(identity) {
  return stellar(['keys', 'show', identity], { quiet: true });
}

/** Read-only contract call (simulated, never sent). */
export function view(contract, fn, args = []) {
  return stellar(['contract', 'invoke', '--id', contract, '--source', 'deployer', ...NET, '--send=no', '--', fn, ...args], { quiet: true });
}

/** Hash of `account`'s newest transaction on Horizon (the CLI's log wording is not stable). */
export function latestTx(account) {
  const res = spawnSync('curl', ['-s', `https://horizon-testnet.stellar.org/accounts/${account}/transactions?order=desc&limit=1`], { encoding: 'utf8' });
  try {
    return JSON.parse(res.stdout)._embedded.records[0].hash;
  } catch {
    return null;
  }
}

/**
 * Sends a contract invocation from a CLI identity and returns { hash, result }.
 * `-v` must precede `--`, after which arguments belong to the contract function.
 */
export function invoke(contract, source, fn, args = []) {
  const res = spawnSync('stellar', ['contract', 'invoke', '--id', contract, '--source', source, ...NET, '--send=yes', '--', fn, ...args], { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`${fn} failed:\n${res.stderr}`);
  }
  return { hash: latestTx(addressOf(source)), result: res.stdout.trim() };
}

/** 1-of-1 vault admin multisig signature over sha256(nonce_be_u64 || fn_name). */
export function adminSigs(fnName) {
  const nonce = BigInt(view(VAULT, 'admin_nonce').replace(/"/g, ''));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(nonce);
  const digest = crypto.createHash('sha256').update(Buffer.concat([msg, Buffer.from(fnName)])).digest();
  const admin = Keypair.fromSecret(secretOf('admin'));
  return JSON.stringify([[admin.rawPublicKey().toString('hex'), admin.sign(digest).toString('hex')]]);
}

/** Append-only step log persisted as JSON. */
export class TxLog {
  constructor(file, header) {
    this.file = file;
    this.data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { ...header, steps: [] };
  }
  has(step) {
    return this.data.steps.some((s) => s.step === step);
  }
  get(step) {
    return this.data.steps.find((s) => s.step === step);
  }
  record(step, { hash = null, actor, ...details } = {}) {
    this.data.steps.push({ step, actor, txHash: hash, explorerUrl: hash && explorerTx(hash), ...details, at: new Date().toISOString() });
    this.save();
    console.log(`✔ ${step}${hash ? `  ${explorerTx(hash)}` : ''}`);
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2) + '\n');
  }
}
