import { PINATA_JWT } from "../config/contracts";

export async function uploadFileToPinata(file) {
  if (!PINATA_JWT) {
    throw new Error("VITE_PINATA_JWT is not set.");
  }
  if (!file) {
    throw new Error("Proof file is required.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pinata upload failed: ${text}`);
  }

  const data = await response.json();
  return data.IpfsHash;
}
