import { IPFS_RPC_AUTH, IPFS_RPC_URL } from "../config/contracts";

export async function uploadFileToPinata(file) {
  if (!IPFS_RPC_URL || !IPFS_RPC_AUTH) {
    throw new Error("Filebase config missing: set VITE_IPFS_RPC_URL and VITE_IPFS_RPC_AUTH.");
  }
  return uploadFileViaIpfsRpc(file);
}

async function uploadFileViaIpfsRpc(file) {
  if (!file) {
    throw new Error("Proof file is required.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const normalizedUrl = IPFS_RPC_URL.endsWith("/") ? IPFS_RPC_URL.slice(0, -1) : IPFS_RPC_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  const response = await fetch(`${normalizedUrl}/api/v0/add?pin=true&cid-version=1&progress=false`, {
    method: "POST",
    headers: {
      // Filebase IPFS RPC key is used as Bearer in browser apps.
      Authorization: `Bearer ${IPFS_RPC_AUTH}`,
    },
    body: formData,
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IPFS RPC upload failed: ${text}`);
  }

  const raw = await response.text();
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines[lines.length - 1] || "{}";
  const data = JSON.parse(lastLine);
  const cid = data?.Hash || data?.Cid?.["/"] || "";
  if (!cid) {
    throw new Error("IPFS RPC did not return a CID.");
  }
  return cid;
}
