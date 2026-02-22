export const SEPOLIA_CHAIN_ID = 11155111;
export const FACTORY_ADDRESS = import.meta.env.VITE_FACTORY_ADDRESS || "";
export const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || "";
export const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

export const factoryAbi = [
  "function createCampaign(string title,string description,uint256 initialGoal,uint256 emergencyTimeout) returns (address)",
  "function getCampaigns() view returns (address[])",
  "function getCampaignCount() view returns (uint256)",
  "event CampaignCreated(address indexed campaignAddress,address indexed creator,string title,uint256 initialGoal,uint256 emergencyTimeout)",
];

export const campaignAbi = [
  "function title() view returns (string)",
  "function description() view returns (string)",
  "function creator() view returns (address)",
  "function initialGoal() view returns (uint256)",
  "function emergencyTimeout() view returns (uint256)",
  "function totalRaised() view returns (uint256)",
  "function totalWithdrawn() view returns (uint256)",
  "function activeVoteId() view returns (uint256)",
  "function pendingApprovedWithdrawal() view returns (uint256)",
  "function pendingApprovedVoteId() view returns (uint256)",
  "function state() view returns (uint8)",
  "function donate() payable",
  "function submitProofAndOpenVote(string proofIpfsHash,uint256 requestedAmount,uint256 votingDurationSeconds)",
  "function castVote(bool support)",
  "function finalizeVote()",
  "function withdrawApprovedAmount()",
  "function claimRefund(uint256 amount)",
  "function cancelCampaign()",
  "function triggerEmergencyRefund()",
  "function getMaxRefundable(address donorAddr) view returns (uint256)",
  "function votes(uint256 voteId) view returns (uint256 id,string proofIpfsHash,uint256 requestedAmount,uint256 snapshotTotalRaised,uint256 yesWeight,uint256 noWeight,uint256 participationWeight,uint256 startAt,uint256 endAt,bool resolved,bool passed)",
  "function donors(address donor) view returns (uint256 totalDonated,uint256 totalRefunded,uint256 withdrawnShare,bool exists)",
];

export const campaignStateLabels = {
  0: "Active",
  1: "VotingActive",
  2: "RefundMode",
  3: "Successful",
  4: "Cancelled",
};
