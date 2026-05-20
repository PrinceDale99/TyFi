import { isConnected, getAddress, setAllowed } from "@stellar/freighter-api";

export const connectWallet = async () => {
  if (await isConnected()) {
    const allowed = await setAllowed();
    if (allowed) {
      const { address } = await getAddress();
      return address;
    }
  } else {
    // If freighter is not installed, we can suggest the user to install it
    window.open("https://chromewebstore.google.com/detail/freighter/kaojnmgeecghoocplkaeoojagghgocho", "_blank");
    throw new Error("Freighter wallet not found. Please install it.");
  }
  return null;
};

export const getWalletAddress = async () => {
  if (await isConnected()) {
    return await getAddress();
  }
  return null;
};

export const checkConnection = async () => {
  return await isConnected();
};
