import { useWallet } from "../contexts/WalletContext";

function shortAddress(address) {
  if (!address) {
    return "";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function WalletConnect() {
  const { address, chainId, isConnected, isConnecting, connect, error } = useWallet();

  return (
    <div className="wallet-box">
      {isConnected ? (
        <>
          <span className="pill">Connected: {shortAddress(address)}</span>
          <span className="pill">Chain: {chainId || "-"}</span>
        </>
      ) : (
        <button onClick={connect} disabled={isConnecting}>
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
