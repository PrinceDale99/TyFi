import { rpc } from '@stellar/stellar-sdk';

async function main() {
  const server = new rpc.Server('https://mainnet.sorobanrpc.com');
  try {
    const account = await server.getAccount('GC5WUJYIISS4623HC67JS33UBWBHEAVB6V6DIVZDDXJQJDMAUDIUO5ED');
    console.log("Account found!", account);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
main();
