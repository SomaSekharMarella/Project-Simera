# Backend Setup (Hardhat)

This folder contains the smart contracts and deployment/test setup for the decentralized Proof-of-Work crowdfunding project.

## What is implemented

- `CampaignFactory.sol`: deploys and tracks campaigns
- `Campaign.sol`: donation, proof submission, weighted voting, withdrawals, refunds, cancellation, emergency refund
- Weighted voting with:
  - majority: `yesWeight > 50%` of snapshot total
  - quorum: `participation >= 30%` of snapshot total
  - auto-pass when no one votes
- Per-proof withdrawal cap: `<= 35%` of initial goal
- One active vote per campaign
- Manual partial refunds in `RefundMode`
- Emergency refund trigger after inactivity timeout
- Creator can finalize vote early (useful for testing)

## Prerequisites

- Node.js 18+ (recommended 20+)
- npm
- Sepolia test ETH in deployer wallet
- Alchemy Sepolia RPC URL

## Install dependencies

```bash
cd Backend
npm install
```

## Environment setup

Create `.env` in `Backend`:

```env
ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-alchemy-key
PRIVATE_KEY=your-private-key-without-0x
```

Notes:
- `PRIVATE_KEY` can be with or without `0x` (config handles both).
- Never commit real secrets.

## Compile and test

```bash
npx hardhat compile
npx hardhat test
```

## Deploy to Sepolia

```bash
npx hardhat ignition deploy ./ignition/modules/CampaignFactory.js --network sepolia
```

If you changed contract bytecode and redeploying with Ignition:

```bash
npx hardhat ignition deploy ./ignition/modules/CampaignFactory.js --network sepolia --reset
```

After deployment, copy the factory address and set it in frontend `.env` as `VITE_FACTORY_ADDRESS`.

## Important files

- `contracts/CampaignFactory.sol`
- `contracts/Campaign.sol`
- `test/CampaignFactory.js`
- `test/Campaign.js`
- `ignition/modules/CampaignFactory.js`
- `hardhat.config.js`
