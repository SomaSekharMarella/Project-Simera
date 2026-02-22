import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEther } from "ethers";
import { PINATA_GATEWAY, SEPOLIA_CHAIN_ID } from "../config/contracts";
import { useWallet } from "../contexts/WalletContext";
import {
  cancelCampaign,
  castVote,
  claimRefund,
  donateToCampaign,
  fetchCampaignDetails,
  finalizeVote,
  submitProof,
  triggerEmergencyRefund,
  withdrawApproved,
} from "../services/campaignService";
import { uploadFileToPinata } from "../services/ipfsService";

function formatWei(wei) {
  try {
    return formatEther(wei);
  } catch {
    return "0";
  }
}

export default function CampaignDetail() {
  const { address: campaignAddress } = useParams();
  const { provider, isConnected, address, chainId } = useWallet();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [donationEth, setDonationEth] = useState("0.01");
  const [refundEth, setRefundEth] = useState("0.01");
  const [proofFile, setProofFile] = useState(null);
  const [requestedAmountEth, setRequestedAmountEth] = useState("0.1");
  const [votingDurationHours, setVotingDurationHours] = useState("1");
  const [proofHashInput, setProofHashInput] = useState("");
  const [busy, setBusy] = useState(false);

  const isCreator = useMemo(() => {
    if (!campaign || !address) {
      return false;
    }
    return campaign.creator.toLowerCase() === address.toLowerCase();
  }, [campaign, address]);

  async function loadCampaign() {
    if (!provider) {
      setLoading(false);
      setStatus("MetaMask provider not found.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const data = await fetchCampaignDetails(campaignAddress, provider, address);
      setCampaign(data);
    } catch (err) {
      setStatus(err?.message || "Failed to load campaign.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, campaignAddress, address]);

  async function withSignerAction(action) {
    if (!provider || !isConnected) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (chainId !== SEPOLIA_CHAIN_ID) {
      setStatus("Switch wallet network to Sepolia.");
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      const signer = await provider.getSigner();
      const txHash = await action(signer);
      setStatus(`Transaction successful: ${txHash}`);
      await loadCampaign();
    } catch (err) {
      setStatus(err?.shortMessage || err?.message || "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleProofSubmit() {
    let proofHash = proofHashInput.trim();
    if (!proofHash && proofFile) {
      setStatus("Uploading proof file to IPFS...");
      proofHash = await uploadFileToPinata(proofFile);
      setProofHashInput(proofHash);
    }
    if (!proofHash) {
      throw new Error("Provide proof hash or upload a proof file.");
    }

    const votingSeconds = Number(votingDurationHours) * 60 * 60;
    return withSignerAction((signer) =>
      submitProof(campaignAddress, signer, proofHash, requestedAmountEth, votingSeconds)
    );
  }

  if (loading) {
    return <p>Loading campaign...</p>;
  }

  if (!campaign) {
    return (
      <section>
        <p>{status || "Campaign not found."}</p>
        <Link to="/">Back to campaigns</Link>
      </section>
    );
  }

  const activeVote = campaign.activeVote;
  const proofPreview = activeVote?.proofIpfsHash
    ? `${PINATA_GATEWAY}${activeVote.proofIpfsHash.replace("ipfs://", "")}`
    : "";

  return (
    <section>
      <Link to="/">Back to campaigns</Link>
      <h2>{campaign.title}</h2>
      <p>{campaign.description}</p>

      <div className="grid two">
        <article className="card">
          <h3>Campaign Info</h3>
          <p>
            <strong>Creator:</strong> {campaign.creator}
          </p>
          <p>
            <strong>State:</strong> {campaign.stateLabel}
          </p>
          <p>
            <strong>Goal:</strong> {formatWei(campaign.initialGoal)} ETH
          </p>
          <p>
            <strong>Total Raised:</strong> {formatWei(campaign.totalRaised)} ETH
          </p>
          <p>
            <strong>Total Withdrawn:</strong> {formatWei(campaign.totalWithdrawn)} ETH
          </p>
          <p>
            <strong>Your Donated:</strong> {formatWei(campaign.donor.totalDonated)} ETH
          </p>
          <p>
            <strong>Your Max Refundable:</strong> {formatWei(campaign.donor.maxRefundable)} ETH
          </p>
        </article>

        <article className="card">
          <h3>Donate</h3>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={donationEth}
            onChange={(e) => setDonationEth(e.target.value)}
          />
          <button disabled={busy} onClick={() => withSignerAction((signer) => donateToCampaign(campaignAddress, signer, donationEth))}>
            Donate
          </button>

          <h3>Refund</h3>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={refundEth}
            onChange={(e) => setRefundEth(e.target.value)}
          />
          <button disabled={busy} onClick={() => withSignerAction((signer) => claimRefund(campaignAddress, signer, refundEth))}>
            Claim Refund
          </button>
        </article>
      </div>

      {activeVote && (
        <article className="card">
          <h3>Active Vote #{activeVote.id}</h3>
          <p>
            <strong>Requested:</strong> {formatWei(activeVote.requestedAmount)} ETH
          </p>
          <p>
            <strong>Yes Weight:</strong> {formatWei(activeVote.yesWeight)}
          </p>
          <p>
            <strong>No Weight:</strong> {formatWei(activeVote.noWeight)}
          </p>
          <p>
            <strong>Participation:</strong> {formatWei(activeVote.participationWeight)} /{" "}
            {formatWei(activeVote.snapshotTotalRaised)}
          </p>
          {activeVote.proofIpfsHash && (
            <p>
              <strong>Proof Hash:</strong> {activeVote.proofIpfsHash}
            </p>
          )}
          {proofPreview && (
            <p>
              <a href={proofPreview} target="_blank" rel="noreferrer">
                Open proof
              </a>
            </p>
          )}
          <div className="row">
            <button disabled={busy} onClick={() => withSignerAction((signer) => castVote(campaignAddress, signer, true))}>
              Vote Agree
            </button>
            <button disabled={busy} onClick={() => withSignerAction((signer) => castVote(campaignAddress, signer, false))}>
              Vote Disagree
            </button>
            <button disabled={busy} onClick={() => withSignerAction((signer) => finalizeVote(campaignAddress, signer))}>
              Finalize Vote
            </button>
          </div>
        </article>
      )}

      {isCreator && campaign.state === 0 && (
        <article className="card">
          <h3>Creator Actions</h3>
          <label>
            Upload proof file
            <input type="file" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
          </label>
          <label>
            Or enter proof CID/hash
            <input value={proofHashInput} onChange={(e) => setProofHashInput(e.target.value)} />
          </label>
          <label>
            Requested Withdrawal (ETH)
            <input
              type="number"
              min="0"
              step="0.0001"
              value={requestedAmountEth}
              onChange={(e) => setRequestedAmountEth(e.target.value)}
            />
          </label>
          <label>
            Voting Duration (hours)
            <input
              type="number"
              min="1"
              value={votingDurationHours}
              onChange={(e) => setVotingDurationHours(e.target.value)}
            />
          </label>

          <div className="row">
            <button disabled={busy} onClick={handleProofSubmit}>
              Submit Proof + Open Vote
            </button>
            <button disabled={busy} onClick={() => withSignerAction((signer) => withdrawApproved(campaignAddress, signer))}>
              Withdraw Approved Amount
            </button>
            <button disabled={busy} onClick={() => withSignerAction((signer) => cancelCampaign(campaignAddress, signer))}>
              Cancel Campaign
            </button>
          </div>
        </article>
      )}

      <article className="card">
        <h3>Emergency Action</h3>
        <button disabled={busy} onClick={() => withSignerAction((signer) => triggerEmergencyRefund(campaignAddress, signer))}>
          Trigger Emergency Refund
        </button>
      </article>

      {status && <p>{status}</p>}
    </section>
  );
}
