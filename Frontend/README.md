# Frontend Setup (React + Vite)

This folder contains the dApp UI for the Proof-of-Work governed crowdfunding system.

## What is implemented

- Wallet connect (MetaMask)
- Factory-based campaign listing (no default campaign)
- Create campaign flow
- Campaign detail page with:
  - donate
  - submit proof (IPFS hash)
  - vote agree/disagree
  - finalize vote
  - creator withdrawal
  - claim refund
  - cancel campaign
  - trigger emergency refund
- Pinata upload integration for proof files

## Prerequisites

- Node.js 18+ (recommended 20+)
- npm
- MetaMask wallet on Sepolia
- Backend factory deployed on Sepolia

## Install dependencies

```bash
cd Frontend
npm install
```

## Environment setup

Create `.env` in `Frontend`:

```env
VITE_FACTORY_ADDRESS=0xYourFactoryAddressOnSepolia
VITE_PINATA_JWT=your-pinata-jwt
VITE_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

Notes:
- `VITE_FACTORY_ADDRESS` is required.
- `VITE_PINATA_JWT` is required only if you upload proof directly from UI.

## Run in development

```bash
npm run dev
```

## Lint and build

```bash
npm run lint
npm run build
npm run preview
```

## User flow

1. Connect wallet
2. Open campaigns list
3. Create a campaign (if needed)
4. Donate to campaign
5. Creator uploads proof and opens vote
6. Donors vote
7. Finalize vote
8. If passed: creator withdraws approved amount
9. If failed: donors claim partial/full refunds
