import { Link } from "react-router-dom";

export default function CampaignCard({ campaign }) {
  return (
    <article className="card">
      <h3>{campaign.title}</h3>
      <p>{campaign.description}</p>
      <p>
        <strong>Address:</strong> {campaign.address}
      </p>
      <p>
        <strong>Goal (wei):</strong> {campaign.initialGoal}
      </p>
      <p>
        <strong>State:</strong> {campaign.stateLabel}
      </p>
      <Link to={`/campaign/${campaign.address}`}>View Campaign</Link>
    </article>
  );
}
