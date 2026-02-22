import { useEffect, useState } from "react";
import CampaignCard from "../components/CampaignCard";
import { useWallet } from "../contexts/WalletContext";
import { fetchCampaignSummaries } from "../services/factoryService";

export default function CampaignList() {
  const { provider } = useWallet();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCampaigns() {
    if (!provider) {
      setLoading(false);
      setError("MetaMask provider not found.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await fetchCampaignSummaries(provider);
      setCampaigns(data);
    } catch (err) {
      setError(err?.message || "Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  return (
    <section>
      <div className="section-head">
        <h2>Campaigns</h2>
        <button onClick={loadCampaigns}>Refresh</button>
      </div>

      {loading && <p>Loading campaigns...</p>}
      {!loading && error && <p className="error-text">{error}</p>}
      {!loading && !error && campaigns.length === 0 && (
        <p>No campaigns yet. Create the first one.</p>
      )}

      <div className="grid">
        {campaigns.map((campaign) => (
          <CampaignCard key={campaign.address} campaign={campaign} />
        ))}
      </div>
    </section>
  );
}
