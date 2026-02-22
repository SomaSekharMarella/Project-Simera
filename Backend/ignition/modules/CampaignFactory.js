const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("CampaignFactoryModule", (m) => {
  const factory = m.contract("CampaignFactory");
  return { factory };
});
