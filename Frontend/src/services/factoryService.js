import { Contract } from "ethers";
import { FACTORY_ADDRESS, campaignAbi, campaignStateLabels, factoryAbi } from "../config/contracts";

function requireFactoryAddress() {
  if (!FACTORY_ADDRESS) {
    throw new Error("VITE_FACTORY_ADDRESS is not set.");
  }
}

export async function getFactoryContract(providerOrSigner) {
  requireFactoryAddress();
  return new Contract(FACTORY_ADDRESS, factoryAbi, providerOrSigner);
}

export async function fetchCampaignAddresses(provider) {
  const factory = await getFactoryContract(provider);
  return factory.getCampaigns();
}

export async function createCampaign(signer, payload) {
  const factory = await getFactoryContract(signer);
  const tx = await factory.createCampaign(
    payload.title,
    payload.description,
    payload.initialGoalWei,
    payload.emergencyTimeoutSeconds
  );
  await tx.wait();
  return tx.hash;
}

export async function fetchCampaignSummaries(provider) {
  const addresses = await fetchCampaignAddresses(provider);
  const summaries = await Promise.all(
    addresses.map(async (address) => {
      const campaign = new Contract(address, campaignAbi, provider);
      const [title, description, initialGoal, state] = await Promise.all([
        campaign.title(),
        campaign.description(),
        campaign.initialGoal(),
        campaign.state(),
      ]);
      return {
        address,
        title,
        description,
        initialGoal: initialGoal.toString(),
        state: Number(state),
        stateLabel: campaignStateLabels[Number(state)] || "Unknown",
      };
    })
  );

  return summaries;
}
