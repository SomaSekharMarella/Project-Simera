/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";

const WalletContext = createContext(null);

function getEthereum() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.ethereum || null;
}

export function WalletProvider({ children }) {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const provider = useMemo(() => {
    const ethereum = getEthereum();
    return ethereum ? new BrowserProvider(ethereum) : null;
  }, []);

  const syncWalletState = useCallback(async () => {
    if (!provider) {
      return;
    }
    const network = await provider.getNetwork();
    setChainId(Number(network.chainId));
    const accounts = await provider.send("eth_accounts", []);
    setAddress(accounts[0] || "");
  }, [provider]);

  async function connect() {
    if (!provider) {
      setError("MetaMask is not available.");
      return;
    }
    setError("");
    setIsConnecting(true);
    try {
      await provider.send("eth_requestAccounts", []);
      await syncWalletState();
    } catch (err) {
      setError(err?.shortMessage || err?.message || "Wallet connection failed.");
    } finally {
      setIsConnecting(false);
    }
  }

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum || !provider) {
      return;
    }

    syncWalletState().catch(() => {});

    const handleAccountsChanged = (accounts) => {
      setAddress(accounts[0] || "");
    };
    const handleChainChanged = () => {
      syncWalletState().catch(() => {});
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [provider, syncWalletState]);

  const value = {
    provider,
    address,
    chainId,
    isConnecting,
    error,
    connect,
    isConnected: Boolean(address),
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside WalletProvider.");
  }
  return ctx;
}
