import admin from 'firebase-admin';

import type { DeviceDescription } from './userAgent';

/**
 * Off-chain metadata for the passkeys (devices) on a smart wallet.
 *
 * The wallet contract is the source of truth for *which* passkeys can sign;
 * this store only adds what a person needs to review their devices: a name,
 * when it was added, and when/where it was last used. IP addresses are only
 * ever returned to a session proven by one of the wallet's own passkeys.
 */
export interface DeviceRecord extends DeviceDescription {
  wallet: string;
  keyId: string; // base64url credential id
  addedAt: number;
  addedIp: string;
  lastSeenAt: number;
  lastSeenIp: string;
  removedAt?: number;
}

export interface DeviceStore {
  /** Record a newly added passkey. */
  add(wallet: string, keyId: string, device: DeviceDescription, ip: string): Promise<void>;
  /** Update last-seen info; creates the record if the device predates tracking. */
  touch(wallet: string, keyId: string, device: DeviceDescription, ip: string): Promise<void>;
  list(wallet: string): Promise<DeviceRecord[]>;
  markRemoved(wallet: string, keyId: string): Promise<void>;
  /** Active wallet for a credential id (used to sign in with an added passkey). */
  findWallet(keyId: string): Promise<string | null>;
}

const docId = (wallet: string, keyId: string) => `${wallet}_${keyId}`;

export class MemoryDeviceStore implements DeviceStore {
  private readonly records = new Map<string, DeviceRecord>();

  async add(wallet: string, keyId: string, device: DeviceDescription, ip: string) {
    const now = Date.now();
    this.records.set(docId(wallet, keyId), { wallet, keyId, ...device, addedAt: now, addedIp: ip, lastSeenAt: now, lastSeenIp: ip });
  }

  async touch(wallet: string, keyId: string, device: DeviceDescription, ip: string) {
    const existing = this.records.get(docId(wallet, keyId));
    if (!existing || existing.removedAt) return this.add(wallet, keyId, device, ip);
    Object.assign(existing, device, { lastSeenAt: Date.now(), lastSeenIp: ip });
  }

  async list(wallet: string) {
    return [...this.records.values()].filter(r => r.wallet === wallet && !r.removedAt).sort((a, b) => a.addedAt - b.addedAt);
  }

  async markRemoved(wallet: string, keyId: string) {
    const existing = this.records.get(docId(wallet, keyId));
    if (existing) existing.removedAt = Date.now();
  }

  async findWallet(keyId: string) {
    return [...this.records.values()].find(r => r.keyId === keyId && !r.removedAt)?.wallet ?? null;
  }
}

export class FirestoreDeviceStore implements DeviceStore {
  constructor(private readonly db: admin.firestore.Firestore, private readonly collection = 'passkey_devices') {}

  private ref(wallet: string, keyId: string) {
    return this.db.collection(this.collection).doc(docId(wallet, keyId));
  }

  async add(wallet: string, keyId: string, device: DeviceDescription, ip: string) {
    const now = Date.now();
    await this.ref(wallet, keyId).set({ wallet, keyId, ...device, addedAt: now, addedIp: ip, lastSeenAt: now, lastSeenIp: ip });
  }

  async touch(wallet: string, keyId: string, device: DeviceDescription, ip: string) {
    const ref = this.ref(wallet, keyId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.removedAt) return this.add(wallet, keyId, device, ip);
    await ref.update({ ...device, lastSeenAt: Date.now(), lastSeenIp: ip });
  }

  async list(wallet: string) {
    const snap = await this.db.collection(this.collection).where('wallet', '==', wallet).get();
    return snap.docs
      .map(d => d.data() as DeviceRecord)
      .filter(r => !r.removedAt)
      .sort((a, b) => a.addedAt - b.addedAt);
  }

  async markRemoved(wallet: string, keyId: string) {
    const ref = this.ref(wallet, keyId);
    if ((await ref.get()).exists) await ref.update({ removedAt: Date.now() });
  }

  async findWallet(keyId: string) {
    const snap = await this.db.collection(this.collection).where('keyId', '==', keyId).get();
    return (snap.docs.map(d => d.data() as DeviceRecord).find(r => !r.removedAt)?.wallet) ?? null;
  }
}

/** Firestore when Firebase Admin is initialized, otherwise in-memory (local dev / tests). */
export function createDeviceStore(): DeviceStore {
  if (admin.apps.length) return new FirestoreDeviceStore(admin.firestore());
  console.warn('[Passkey] Firebase Admin not initialized: device records are kept in memory only.');
  return new MemoryDeviceStore();
}
