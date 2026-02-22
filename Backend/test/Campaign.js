const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("Campaign", function () {
  async function deployCampaignFixture() {
    const [creator, donor1, donor2, donor3] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy();

    const initialGoal = ethers.parseEther("10");
    const emergencyTimeout = 15 * 24 * 60 * 60;

    await factory
      .connect(creator)
      .createCampaign("Medical Help", "Community health fund", initialGoal, emergencyTimeout);

    const campaigns = await factory.getCampaigns();
    const campaign = await ethers.getContractAt("Campaign", campaigns[0]);

    return { factory, campaign, creator, donor1, donor2, donor3, initialGoal, emergencyTimeout };
  }

  async function openVoteFixture() {
    const setup = await deployCampaignFixture();
    const { campaign, donor1, donor2 } = setup;

    await campaign.connect(donor1).donate({ value: ethers.parseEther("6") });
    await campaign.connect(donor2).donate({ value: ethers.parseEther("4") });

    const requestAmount = ethers.parseEther("3.5");
    const votingDuration = 3600;
    await campaign
      .connect(setup.creator)
      .submitProofAndOpenVote("ipfs://proof-1", requestAmount, votingDuration);

    return { ...setup, requestAmount, votingDuration };
  }

  it("accepts donations and tracks donor data", async function () {
    const { campaign, donor1 } = await loadFixture(deployCampaignFixture);
    const donateAmount = ethers.parseEther("1");

    await expect(campaign.connect(donor1).donate({ value: donateAmount }))
      .to.emit(campaign, "Donated")
      .withArgs(donor1.address, donateAmount, donateAmount);

    const donor = await campaign.donors(donor1.address);
    expect(donor.totalDonated).to.equal(donateAmount);
    expect(await campaign.totalRaised()).to.equal(donateAmount);
    expect(await campaign.getDonorCount()).to.equal(1n);
  });

  it("enforces one active vote at a time", async function () {
    const { campaign, creator, requestAmount } = await loadFixture(openVoteFixture);

    await expect(
      campaign.connect(creator).submitProofAndOpenVote("ipfs://proof-2", requestAmount, 3600)
    ).to.be.revertedWith("Campaign not active");
  });

  it("snapshots voting power and excludes new donors from active vote", async function () {
    const { campaign, donor3 } = await loadFixture(openVoteFixture);

    await campaign.connect(donor3).donate({ value: ethers.parseEther("2") });
    expect(await campaign.getVoteWeight(1, donor3.address)).to.equal(0n);

    await expect(campaign.connect(donor3).castVote(true)).to.be.revertedWith("No voting weight");
  });

  it("auto-passes when nobody votes", async function () {
    const { campaign, creator, requestAmount } = await loadFixture(openVoteFixture);
    const vote = await campaign.votes(1);
    await time.increaseTo(vote.endAt);

    await expect(campaign.finalizeVote())
      .to.emit(campaign, "VoteFinalized")
      .withArgs(1, true, true, 0, 0, 0);

    expect(await campaign.pendingApprovedWithdrawal()).to.equal(requestAmount);
    expect(await campaign.activeVoteId()).to.equal(0n);
    expect(await campaign.state()).to.equal(0n);

    await expect(campaign.connect(creator).withdrawApprovedAmount())
      .to.emit(campaign, "WithdrawalExecuted")
      .withArgs(1, requestAmount);
  });

  it("passes with weighted majority and creator can withdraw", async function () {
    const { campaign, creator, donor1, requestAmount } = await loadFixture(openVoteFixture);
    await campaign.connect(donor1).castVote(true);

    const vote = await campaign.votes(1);
    await time.increaseTo(vote.endAt);
    await campaign.finalizeVote();

    await expect(campaign.connect(creator).withdrawApprovedAmount()).to.changeEtherBalances(
      [creator, campaign],
      [requestAmount, -requestAmount]
    );

    expect(await campaign.totalWithdrawn()).to.equal(requestAmount);
  });

  it("allows creator to finalize vote before deadline", async function () {
    const { campaign, creator, donor1, requestAmount } = await loadFixture(openVoteFixture);
    await campaign.connect(donor1).castVote(true);

    await campaign.connect(creator).finalizeVote();
    expect(await campaign.pendingApprovedWithdrawal()).to.equal(requestAmount);
    expect(await campaign.activeVoteId()).to.equal(0n);
  });

  it("fails vote and allows partial refunds in refund mode", async function () {
    const { campaign, donor1, donor2 } = await loadFixture(openVoteFixture);
    await campaign.connect(donor1).castVote(false);
    await campaign.connect(donor2).castVote(false);

    const vote = await campaign.votes(1);
    await time.increaseTo(vote.endAt);
    await campaign.finalizeVote();

    expect(await campaign.state()).to.equal(2n);

    const partialRefund = ethers.parseEther("1.5");
    await expect(() => campaign.connect(donor1).claimRefund(partialRefund)).to.changeEtherBalances(
      [donor1, campaign],
      [partialRefund, -partialRefund]
    );

    const remaining = await campaign.getMaxRefundable(donor1.address);
    expect(remaining).to.equal(ethers.parseEther("4.5"));
  });

  it("enforces 35% per proof withdrawal cap", async function () {
    const { campaign, creator } = await loadFixture(deployCampaignFixture);
    await campaign.connect(creator).donate({ value: ethers.parseEther("10") });

    const tooHigh = ethers.parseEther("3.500000000000000001");
    await expect(
      campaign.connect(creator).submitProofAndOpenVote("ipfs://proof-high", tooHigh, 3600)
    ).to.be.revertedWith("Request exceeds 35% of initial goal");
  });

  it("allows creator cancellation before withdrawals and refunds donors", async function () {
    const { campaign, creator, donor1, donor2 } = await loadFixture(deployCampaignFixture);
    await campaign.connect(donor1).donate({ value: ethers.parseEther("2") });
    await campaign.connect(donor2).donate({ value: ethers.parseEther("3") });

    await expect(() => campaign.connect(creator).cancelCampaign()).to.changeEtherBalances(
      [campaign, donor1, donor2],
      [-ethers.parseEther("5"), ethers.parseEther("2"), ethers.parseEther("3")]
    );

    expect(await campaign.state()).to.equal(4n);
  });

  it("blocks cancellation after successful withdrawal", async function () {
    const { campaign, creator, donor1 } = await loadFixture(openVoteFixture);
    await campaign.connect(donor1).castVote(true);
    const vote = await campaign.votes(1);
    await time.increaseTo(vote.endAt);
    await campaign.finalizeVote();
    await campaign.connect(creator).withdrawApprovedAmount();

    await expect(campaign.connect(creator).cancelCampaign()).to.be.revertedWith(
      "Cannot cancel after withdrawal"
    );
  });

  it("triggers emergency refund after timeout", async function () {
    const { campaign, emergencyTimeout } = await loadFixture(deployCampaignFixture);
    const nextTime = (await time.latest()) + emergencyTimeout + 1;
    await time.increaseTo(nextTime);

    await campaign.triggerEmergencyRefund();
    expect(await campaign.state()).to.equal(2n);
  });
});
