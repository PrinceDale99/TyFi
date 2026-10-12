import { posthog, isPostHogEnabled } from './posthog';

// ─── Strongly Typed Event Payloads ──────────────────────────────────────────

export type StellarNetwork = 'testnet' | 'mainnet';
export type WalletType = 'freighter' | 'albedo' | 'walletconnect' | 'rabet' | 'xbull' | 'in_app' | 'other';
export type TxAction =
  | 'subscribe_policy'
  | 'deposit_reinsurance'
  | 'withdraw_reinsurance'
  | 'deposit_subsidy'
  | 'claim_payout'
  | 'submit_weather_report'
  | 'dao_vote'
  | 'dao_create_proposal';
export type TxStage = 'simulation' | 'wallet_signing' | 'submission' | 'on_chain_confirmation';

/** Optional context attached to transaction events (used by DAO governance actions). */
export interface TxEventContext {
  proposal_id?: number;
  vote?: 'for' | 'against';
  proposal_action?: string;
  voting_duration_ledgers?: number;
}

export interface LandingPageViewedProps {
  referrer?: string;
  source?: string;
  locale?: string;
}

export interface WalletConnectionAttemptedProps {
  wallet_type: WalletType;
  network: StellarNetwork;
  entry_point?: 'header_button' | 'hero_cta' | 'modal_prompt';
}

export interface WalletConnectionSuccessfulProps {
  /** Omitted for the in-app wallet, which has no real Stellar account. */
  stellar_address?: string;
  wallet_type: WalletType;
  network: StellarNetwork;
}

export interface WalletConnectionFailedProps {
  wallet_type: WalletType;
  network: StellarNetwork;
  error_code: string;
  error_message: string;
  user_rejected: boolean;
}

export interface VaultDepositInitiatedProps {
  deposit_type: 'parametric_policy' | 'reinsurance_pool' | 'premium_subsidy';
  amount_xlm?: number;
  region?: string;
  crop_type?: string;
  season?: string;
  network: StellarNetwork;
}

export interface TransactionSignedProps extends TxEventContext {
  action: TxAction;
  contract_id: string;
  wallet_address: string;
  network: StellarNetwork;
}

export interface TransactionConfirmedProps extends TxEventContext {
  tx_hash: string;
  action: TxAction;
  amount_xlm?: number;
  sponsored_fee: boolean;
  sponsor_provider?: 'velo' | 'tyfi_relayer' | 'none';
  ledger_sequence?: number;
  network: StellarNetwork;
}

export interface TransactionFailedProps extends TxEventContext {
  action: TxAction;
  stage: TxStage;
  error_code: string | number;
  error_message: string;
  user_rejected: boolean;
  network: StellarNetwork;
}

/** In-app wallet sessions use generated ids rather than real Stellar accounts. */
export const isInAppWalletId = (id: string) => id.startsWith('DEMO_TESTNET');

export const walletTypeFromId = (walletId: string): WalletType => {
  if (isInAppWalletId(walletId)) return 'in_app';
  const id = walletId.toLowerCase().replace(/[^a-z]/g, '');
  if (id === 'freighter' || id === 'albedo' || id === 'walletconnect' || id === 'rabet' || id === 'xbull') return id;
  return 'other';
};

// ─── TyFi Analytics Engine ────────────────────────────────────────────────────

class AnalyticsService {
  private landingTracked = false;

  /** Analytics must never break a user flow, so every capture is guarded. */
  private capture(event: string, props?: object) {
    if (!isPostHogEnabled || typeof window === 'undefined') return;
    try {
      posthog.capture(event, props as Record<string, unknown>);
    } catch (error) {
      console.warn(`[analytics] Failed to capture ${event}:`, error);
    }
  }

  /**
   * 1. Funnel Event: tyfi_landing_page_viewed
   * Fired once per page load when the user lands on the application.
   */
  public trackLandingPageViewed(props?: LandingPageViewedProps) {
    if (this.landingTracked) return;
    this.landingTracked = true;
    this.capture('tyfi_landing_page_viewed', {
      referrer: document.referrer || 'direct',
      locale: navigator.language,
      source: new URLSearchParams(window.location.search).get('utm_source') ?? undefined,
      ...props,
    });
  }

  /**
   * 2. Funnel Event: wallet_connection_attempted
   * Fired when the user picks a wallet to connect.
   */
  public trackWalletConnectionAttempted(props: WalletConnectionAttemptedProps) {
    this.capture('wallet_connection_attempted', props);
  }

  /**
   * 3. Funnel Event: wallet_connection_successful
   * The Stellar address is stored as a person property via $set. Identity itself
   * (posthog.identify / reset) is owned by App.tsx so reconnects on reload are covered too.
   */
  public trackWalletConnectionSuccessful(props: WalletConnectionSuccessfulProps) {
    this.capture('wallet_connection_successful', {
      ...props,
      $set: {
        ...(props.stellar_address ? { stellar_address: props.stellar_address } : {}),
        primary_wallet: props.wallet_type,
        preferred_network: props.network,
      },
      $set_once: { first_connected_at: new Date().toISOString() },
    });
  }

  /**
   * Fired when the connection fails or the user dismisses the wallet popup.
   */
  public trackWalletConnectionFailed(props: WalletConnectionFailedProps) {
    this.capture('wallet_connection_failed', props);
  }

  /**
   * 4. Funnel Event: vault_deposit_initiated
   * Fired when the user commits to funding the vault (policy premium, reinsurance or subsidy).
   */
  public trackVaultDepositInitiated(props: VaultDepositInitiatedProps) {
    this.capture('vault_deposit_initiated', props);
  }

  /**
   * 5. Funnel Event: transaction_signed
   * Fired when the user approves the Soroban smart contract payload in their wallet.
   */
  public trackTransactionSigned(props: TransactionSignedProps) {
    this.capture('transaction_signed', props);
  }

  /**
   * 6. Funnel Event: transaction_confirmed
   * Fired when the Stellar network confirms the transaction.
   */
  public trackTransactionConfirmed(props: TransactionConfirmedProps) {
    const explorerNetwork = props.network === 'mainnet' ? 'public' : 'testnet';
    this.capture('transaction_confirmed', {
      ...props,
      explorer_url: `https://stellar.expert/explorer/${explorerNetwork}/tx/${props.tx_hash}`,
    });
  }

  /**
   * 7. Funnel Event: transaction_failed
   * Fired if contract execution fails or the wallet rejects the signature.
   */
  public trackTransactionFailed(props: TransactionFailedProps) {
    this.capture('transaction_failed', props);
  }
}

export const analytics = new AnalyticsService();
