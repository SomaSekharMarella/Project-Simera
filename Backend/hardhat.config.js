require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const alchemyRpcUrl = (process.env.ALCHEMY_RPC_URL || "").trim();
const privateKeyRaw = (process.env.PRIVATE_KEY || "").trim();
const privateKey = privateKeyRaw
  ? privateKeyRaw.startsWith("0x")
    ? privateKeyRaw
    : `0x${privateKeyRaw}`
  : "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: alchemyRpcUrl
    ? {
        sepolia: {
          url: alchemyRpcUrl,
          accounts: privateKey ? [privateKey] : [],
        },
      }
    : {},
};
