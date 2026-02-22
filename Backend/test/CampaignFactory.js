const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("CampaignFactory", function () {
  async function deployFactoryFixture() {
    const [creator, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();
    return { factory, creator, other };
  }

  it("starts with zero campaigns", async function () {
    const { factory } = await loadFixture(deployFactoryFixture);
    expect(await factory.getCampaignCount()).to.equal(0n);

    const campaigns = await factory.getCampaigns();
    expect(campaigns.length).to.equal(0);
  });

  it("creates a campaign and stores address", async function () {
    const { factory, creator } = await loadFixture(deployFactoryFixture);
    const goal = ethers.parseEther("10");
    const timeout = 15 * 24 * 60 * 60;

    const tx = await factory.createCampaign("Road Repair", "Fixing local roads", goal, timeout);
    const receipt = await tx.wait();

    const createdEvent = receipt.logs.find((log) => log.fragment && log.fragment.name === "CampaignCreated");
    expect(createdEvent.args.creator).to.equal(creator.address);

    expect(await factory.getCampaignCount()).to.equal(1n);
    const campaigns = await factory.getCampaigns();
    expect(campaigns.length).to.equal(1);

    const campaign = await ethers.getContractAt("Campaign", campaigns[0]);
    expect(await campaign.creator()).to.equal(creator.address);
    expect(await campaign.title()).to.equal("Road Repair");
    expect(await campaign.initialGoal()).to.equal(goal);
    expect(await campaign.emergencyTimeout()).to.equal(BigInt(timeout));
  });

  it("supports multiple campaign deployments", async function () {
    const { factory, creator, other } = await loadFixture(deployFactoryFixture);
    const goal = ethers.parseEther("5");
    const timeout = 7 * 24 * 60 * 60;

    await factory.createCampaign("Campaign 1", "Desc 1", goal, timeout);
    await factory.connect(other).createCampaign("Campaign 2", "Desc 2", goal, timeout);

    expect(await factory.getCampaignCount()).to.equal(2n);
    const campaigns = await factory.getCampaigns();
    expect(campaigns.length).to.equal(2);
    expect(campaigns[0]).to.not.equal(campaigns[1]);

    const campaign1 = await ethers.getContractAt("Campaign", campaigns[0]);
    const campaign2 = await ethers.getContractAt("Campaign", campaigns[1]);
    expect(await campaign1.creator()).to.equal(creator.address);
    expect(await campaign2.creator()).to.equal(other.address);
  });
});
