import { Networks } from '@stellar/stellar-sdk';
import * as dotenv from 'dotenv';
dotenv.config();

export const NETWORK_CONFIGS = {
  testnet: {
    rpcUrl: process.env.SOROBAN_RPC_URL_TESTNET || 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: Networks.TESTNET,
    vaultContractId: process.env.CONTRACT_ID_TESTNET || 'CCA7FZTWEJDESXHLOENHB6FV3DN5YZYZDNZWKKUPPP2NGNSJCZ7APEYH',
    daoContractId: 'CCYYM6VOPD7HUP337W4334A2MYL6KAZ55K4JMXYOPX3EWYDSDYY6C23G'
  },
  mainnet: {
    rpcUrl: process.env.SOROBAN_RPC_URL_MAINNET || 'https://mainnet.sorobanrpc.com',
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: Networks.PUBLIC,
    vaultContractId: process.env.CONTRACT_ID_MAINNET || 'CAQCA3H4UIGESIJZE3LF7TYKQY6TBQV2OQ7OVBRRRRIARX5JOTXZUNVT',
    daoContractId: 'CCSOWCGXDJSZJ3TLQOHHIC5YKD6XLF2WOSIZE5FLNDTXB73J76TXLDAO'
  }
};
