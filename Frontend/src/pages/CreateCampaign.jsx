import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseEther } from "ethers";
import { useWallet } from "../contexts/WalletContext";
import { createCampaign } from "../services/factoryService";

export default function CreateCampaign() {
  const navigate = useNavigate();
  const { provider, isConnected } = useWallet();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [initialGoalEth, setInitialGoalEth] = useState("");
  const [emergencyDays, setEmergencyDays] = useState("15");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!provider || !isConnected) {
      setStatus("Connect your wallet first.");
      return;
    }

    setLoading(true);
    setStatus("");
    try {
      const signer = await provider.getSigner();
      const payload = {
        title: title.trim(),
        description: description.trim(),
        initialGoalWei: parseEther(initialGoalEth),
        emergencyTimeoutSeconds: Number(emergencyDays) * 24 * 60 * 60,
      };
      await createCampaign(signer, payload);
      setStatus("Campaign created successfully.");
      setTitle("");
      setDescription("");
      setInitialGoalEth("");
      setEmergencyDays("15");
      navigate("/");
    } catch (err) {
      setStatus(err?.shortMessage || err?.message || "Campaign creation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="form-wrap">
      <h2>Create Campaign</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
        </label>

        <label>
          Initial Goal (ETH)
          <input
            type="number"
            min="0"
            step="0.0001"
            value={initialGoalEth}
            onChange={(e) => setInitialGoalEth(e.target.value)}
            required
          />
        </label>

        <label>
          Emergency Timeout (days)
          <input
            type="number"
            min="1"
            value={emergencyDays}
            onChange={(e) => setEmergencyDays(e.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Campaign"}
        </button>
      </form>

      {status && <p>{status}</p>}
    </section>
  );
}
