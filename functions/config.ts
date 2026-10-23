import { Networks } from '@stellar/stellar-sdk';
import * as dotenv from 'dotenv';
dotenv.config();

export const NETWORK_CONFIGS = {
  testnet: {
    rpcUrl: process.env.SOROBAN_RPC_URL_TESTNET || 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: Networks.TESTNET,
    vaultContractId: process.env.CONTRACT_ID_TESTNET || 'CARODUWJWUBI5UPKQCAVGT7GXKJN65ZDVEOPSYCWPBGC6F5MYQJXCQZR',
    // The deployed week 2 DAO (contracts/deployments/testnet.json); CCYYM… was a stale id.
    daoContractId: process.env.DAO_CONTRACT_ID_TESTNET || 'CB3A3IZMHF7EUM75CP5FFA6XZNABLRZAT5JL6XC4SZX3FWGRVMQM6KPY'
  },
  mainnet: {
    rpcUrl: process.env.SOROBAN_RPC_URL_MAINNET || 'https://mainnet.sorobanrpc.com',
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: Networks.PUBLIC,
    vaultContractId: process.env.CONTRACT_ID_MAINNET || 'CAQCA3H4UIGESIJZE3LF7TYKQY6TBQV2OQ7OVBRRRRIARX5JOTXZUNVT',
    daoContractId: 'CCSOWCGXDJSZJ3TLQOHHIC5YKD6XLF2WOSIZE5FLNDTXB73J76TXLDAO'
  }
};
