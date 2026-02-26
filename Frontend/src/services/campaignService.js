import { Contract, formatEther, parseEther } from "ethers";
import { campaignAbi, campaignStateLabels } from "../config/contracts";

export function getCampaignContract(address, providerOrSigner) {
  return new Contract(address, campaignAbi, providerOrSigner);
}

export async function fetchCampaignDetails(address, provider, viewerAddress) {
  const campaign = getCampaignContract(address, provider);
  const [
    title,
    description,
    creator,
    initialGoal,
    emergencyTimeout,
    totalRaised,
    totalWithdrawn,
    nextVoteId,
    activeVoteId,
    latestPassedVoteId,
    pendingApprovedWithdrawal,
    state,
    donorRecord,
    canClaimDissenter,
    maxRefundable,
  ] = await Promise.all([
    campaign.title(),
    campaign.description(),
    campaign.creator(),
    campaign.initialGoal(),
    campaign.emergencyTimeout(),
    campaign.totalRaised(),
    campaign.totalWithdrawn(),
    campaign.nextVoteId(),
    campaign.activeVoteId(),
    campaign.latestPassedVoteId(),
    campaign.pendingApprovedWithdrawal(),
    campaign.state(),
    viewerAddress ? campaign.donors(viewerAddress) : Promise.resolve([0n, 0n, 0n, false]),
    viewerAddress ? campaign.canClaimDissenterRefund(viewerAddress) : Promise.resolve(false),
    viewerAddress ? campaign.getMaxRefundable(viewerAddress) : Promise.resolve(0n),
  ]);

  let activeVote = null;
  if (Number(activeVoteId) > 0) {
    const vote = await campaign.votes(activeVoteId);
    activeVote = {
      id: Number(vote.id),
      proofIpfsHash: vote.proofIpfsHash,
      requestedAmount: vote.requestedAmount.toString(),
      snapshotTotalRaised: vote.snapshotTotalRaised.toString(),
      yesWeight: vote.yesWeight.toString(),
      noWeight: vote.noWeight.toString(),
      participationWeight: vote.participationWeight.toString(),
      startAt: Number(vote.startAt),
      endAt: Number(vote.endAt),
      resolved: vote.resolved,
      passed: vote.passed,
    };
  }

  const voteHistory = [];
  const totalVotes = Number(nextVoteId);
  for (let i = 1; i <= totalVotes; i += 1) {
    const vote = await campaign.votes(i);
    voteHistory.push({
      id: Number(vote.id),
      proofIpfsHash: vote.proofIpfsHash,
      requestedAmount: vote.requestedAmount.toString(),
      snapshotTotalRaised: vote.snapshotTotalRaised.toString(),
      yesWeight: vote.yesWeight.toString(),
      noWeight: vote.noWeight.toString(),
      participationWeight: vote.participationWeight.toString(),
      startAt: Number(vote.startAt),
      endAt: Number(vote.endAt),
      resolved: vote.resolved,
      passed: vote.passed,
    });
  }

  return {
    title,
    description,
    creator,
    initialGoal: initialGoal.toString(),
    emergencyTimeout: Number(emergencyTimeout),
    totalRaised: totalRaised.toString(),
    totalWithdrawn: totalWithdrawn.toString(),
    nextVoteId: Number(nextVoteId),
    pendingApprovedWithdrawal: pendingApprovedWithdrawal.toString(),
    latestPassedVoteId: Number(latestPassedVoteId),
    activeVoteId: Number(activeVoteId),
    state: Number(state),
    stateLabel: campaignStateLabels[Number(state)] || "Unknown",
    donor: {
      totalDonated: donorRecord.totalDonated?.toString?.() || "0",
      totalRefunded: donorRecord.totalRefunded?.toString?.() || "0",
      withdrawnShare: donorRecord.withdrawnShare?.toString?.() || "0",
      exists: Boolean(donorRecord.exists),
      maxRefundable: maxRefundable.toString(),
      canClaimDissenter: Boolean(canClaimDissenter),
    },
    activeVote,
    voteHistory,
  };
}

export async function donateToCampaign(address, signer, amountEth) {
  const campaign = getCampaignContract(address, signer);
  const tx = await campaign.donate({ value: parseEther(String(amountEth)) });
  await tx.wait();
  return tx.hash;
}

export async function submitProof(address, signer, proofIpfsHash, requestedAmountEth, votingDurationSeconds) {
  const campaign = getCampaignContract(address, signer);
  const tx = await campaign.submitProofAndOpenVote(
    proofIpfsHash,
    parseEther(String(requestedAmountEth)),
    votingDurationSeconds
  );
  await tx.wait();
  return tx.hash;
}

export async function castVote(address, signer, support) {
  const campaign = getCampaignContract(address, signer);
  const tx = await campaign.castVote(support);
  await tx.wait();
  return tx.hash;
}

export async function finalizeVote(address, signer) {
  const campaign = getCampaignContract(address, signer);
  const tx = await campaign.finalizeVote();
  await tx.wait();
  return tx.hash;
}

export async function withdrawApproved(address, signer) {
  const campaign = getCampaignContract(address, signer);
  const tx = await campaign.withdrawApprovedAmount();
  await tx.wait();
  return tx.hash;
}

export async function claimRefund(address, signer, amountEth) {
  const campaign = getCampaignContract(address, signer);
  const tx = await campaign.claimRefund(parseEther(String(amountEth)));
  await tx.wait();
  return tx.hash;
}

export async function claimDissenterRefund(address, signer, amountEth) {
  const campaign = getCampaignContract(address, signer);
  const tx = await campaign.claimDissenterRefund(parseEther(String(amountEth)));
  await tx.wait();
  return tx.hash;
}

export async function triggerEmergencyRefund(address, signer) {
  const campaign = getCampaignContract(address, signer);
  const tx = await campaign.triggerEmergencyRefund();
  await tx.wait();
  return tx.hash;
}

export async function cancelCampaign(address, signer) {
  const campaign = getCampaignContract(address, signer);
  const tx = await campaign.cancelCampaign();
  await tx.wait();
  return tx.hash;
}

export function toWei(value) {
  return parseEther(String(value || "0"));
}

export function toEth(weiValue) {
  return formatEther(weiValue || 0);
}
