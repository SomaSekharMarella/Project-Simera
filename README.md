# Proof-of-Work Governed Crowdfunding (Sepolia)

A fully decentralized crowdfunding dApp where campaign creators must submit proof of work and pass donor voting before withdrawing funds.

## Project overview

This project uses:

- **Backend**: Solidity + Hardhat
- **Frontend**: React + Vite + ethers
- **Network**: Ethereum Sepolia testnet
- **Proof storage**: IPFS (Pinata)

No admin role, no token logic, and no centralized control.

## Core features

- Factory-based architecture:
  - no campaign exists by default
  - campaigns are created only by users
- Weighted donor voting:
  - vote power based on donated amount snapshot
  - approval requires `>50%` yes weight
  - quorum requires `>=30%` participation
  - auto-pass if no one votes
- Proof-based withdrawal:
  - creator submits IPFS proof hash
  - one active vote per campaign
  - each request capped to `<=35%` of initial goal
- Refund protection:
  - if vote fails, campaign enters `RefundMode`
  - donors can claim partial or full remaining refundable amount
- Emergency safety:
  - inactivity timeout can move campaign to `RefundMode`
- Cancellation:
  - creator can cancel before any withdrawal and auto-refund donors

## Campaign states

- `Active`
- `VotingActive`
- `RefundMode`
- `Successful`
- `Cancelled`

## Monorepo structure

- `Backend/` smart contracts, tests, deployment config
- `Frontend/` React dApp UI and wallet/IPFS integration

## Quick start

### 1) Backend

```bash
cd Backend
npm install
```

Create `Backend/.env`:

```env
ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-alchemy-key
PRIVATE_KEY=your-private-key-without-0x
```

Run:

```bash
npx hardhat compile
npx hardhat test
npx hardhat ignition deploy ./ignition/modules/CampaignFactory.js --network sepolia
```

If redeploying after contract changes:

```bash
npx hardhat ignition deploy ./ignition/modules/CampaignFactory.js --network sepolia --reset
```

### 2) Frontend

```bash
cd Frontend
npm install
```

Create `Frontend/.env`:

```env
VITE_FACTORY_ADDRESS=0xYourFactoryAddressOnSepolia
VITE_PINATA_JWT=your-pinata-jwt
VITE_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

Run:

```bash
npm run dev
```

## Important notes

- Keep private keys and JWT secrets out of git.
- For testing, creator can finalize vote early (without waiting full duration).
- For production, consider tighter voting constraints and gas optimizations.
