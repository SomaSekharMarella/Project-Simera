# Detailed Implementation Documentation

This document captures the complete implementation status of the project so far, including architecture, backend contracts, frontend modules, every key function, behavior notes, limitations, and suggested future improvements.

## 1) Project Overview

This is a decentralized Proof-of-Work governed crowdfunding dApp on Ethereum Sepolia.

Core idea:
- A campaign creator cannot directly withdraw funds.
- Creator must submit proof (IPFS hash).
- Donors vote using donation-weighted voting.
- If vote passes, creator can withdraw approved amount.
- If vote fails, donors can claim refunds.
- Additional dev-stage behavior is implemented for easier testing.

No admin role and no token logic are included.

## 2) High-Level Architecture

- Backend: Solidity contracts + Hardhat
- Frontend: React + Vite + ethers
- Storage for proof files: Filebase IPFS RPC
- Network: Sepolia (chain id 11155111)

Contract topology:
- `CampaignFactory` deploys one `Campaign` contract per campaign.
- Frontend fetches campaign addresses from factory and interacts directly with each campaign contract.

## 3) Backend Implementation

### 3.1 `CampaignFactory` Contract

File: `Backend/contracts/CampaignFactory.sol`

Implemented functions:
- `createCampaign(title, description, initialGoal, emergencyTimeout)`
  - Deploys a new `Campaign` contract.
  - Stores campaign address in `campaigns[]`.
  - Emits `CampaignCreated`.
- `getCampaigns()`
  - Returns all campaign addresses.
- `getCampaignCount()`
  - Returns total count.

Behavior:
- No campaign is auto-created by default.
- Campaigns appear only when a user creates them.

### 3.2 `Campaign` Contract

File: `Backend/contracts/Campaign.sol`

#### 3.2.1 State Model

`CampaignState`:
- `Active`
- `VotingActive`
- `RefundMode`
- `Successful`
- `Cancelled`

#### 3.2.2 Data Structures

`Donor`:
- `totalDonated`
- `totalRefunded`
- `withdrawnShare`
- `exists`

`VoteRequest`:
- `id`
- `proofIpfsHash`
- `requestedAmount`
- `snapshotTotalRaised`
- `yesWeight`
- `noWeight`
- `participationWeight`
- `startAt`
- `endAt`
- `resolved`
- `passed`

Other important storage:
- `totalRaised`
- `totalWithdrawn`
- `activeVoteId`
- `pendingApprovedWithdrawal`
- `pendingApprovedVoteId`
- `latestPassedVoteId`
- `voteWeights[voteId][donor]`
- `hasVoted[voteId][donor]`
- `votedNo[voteId][donor]`

#### 3.2.3 Access Controls and Safety

- `onlyCreator` modifier for creator-only actions.
- `nonReentrant` lock for transfer functions.

#### 3.2.4 Function-by-Function Behavior

1. `donate()`
- Allowed in `Active` and `VotingActive`.
- Adds donor if first-time.
- Increases `donor.totalDonated` and `totalRaised`.
- Emits `Donated`.

2. `submitProofAndOpenVote(proofIpfsHash, requestedAmount, votingDurationSeconds)`
- Creator-only.
- Only in `Active`.
- Enforces one active vote.
- Requires non-empty proof hash.
- Withdrawal request capped to `<= 35%` of `initialGoal`.
- Snapshot logic:
  - captures `snapshotTotalRaised`
  - snapshots vote weights per donor (`totalDonated - totalRefunded`)
- Sets state to `VotingActive`.
- Emits `ProofSubmitted`.

3. `castVote(bool support)`
- Requires active vote.
- Voting allowed only before `endAt`.
- One vote per donor per vote.
- Uses snapshot weight.
- Updates yes/no/participation weights.
- Marks `votedNo` on no-vote.
- Emits `Voted`.

4. `finalizeVote()`
- Requires active vote.
- Can finalize if:
  - normal user: after vote end time
  - creator: can force finalize early (dev feature)
- Rules:
  - Auto-pass if participation is zero.
  - Otherwise pass only if:
    - yes weight > 50% of snapshot total
    - participation >= 30% of snapshot total
- If passed:
  - sets `pendingApprovedWithdrawal`
  - sets `pendingApprovedVoteId`
  - sets `latestPassedVoteId`
  - returns to `Active`
- If failed:
  - goes to `RefundMode`
- Emits `VoteFinalized`.

5. `withdrawApprovedAmount()`
- Creator-only, non-reentrant.
- Requires approved pending amount.
- Transfers approved amount to creator.
- Updates `totalWithdrawn`.
- Distributes proportional `withdrawnShare` across donors based on snapshot weights.
- If contract balance reaches zero and no active vote, marks `Successful`.
- Emits `WithdrawalExecuted`.

6. `claimRefund(amount)`
- Non-reentrant.
- Only in `RefundMode`.
- Partial/full claim supported.
- Validated by `getMaxRefundable`.
- Transfers amount to caller.
- Updates:
  - `totalRefunded`
  - `totalRaised` (decreases on refund)
- Emits `RefundClaimed`.

7. `claimDissenterRefund(amount)`
- Non-reentrant.
- For no-voters on latest passed vote.
- Allowed outside `RefundMode`.
- Requires caller voted no in `latestPassedVoteId`.
- Validated by `getMaxRefundable`.
- Transfers amount to caller.
- Updates:
  - `totalRefunded`
  - `totalRaised` (decreases on refund)
- Emits `DissenterRefundClaimed`.

8. `cancelCampaign()`
- Creator-only, non-reentrant.
- Allowed in `Active`/`VotingActive`.
- Not allowed after any withdrawal.
- Cancels vote/pending states.
- Auto-refunds all donors by `getMaxRefundable`.
- Decreases `totalRaised` for each auto-refund.
- Sets state to `Cancelled`.
- Emits `CampaignCancelled`.

9. `triggerEmergencyRefund()`
- Creator-only (dev-stage behavior).
- Allowed in `Active` or `VotingActive`.
- Immediately forces `RefundMode`.
- Clears active/pending vote pointers.
- No timeout check in current dev mode.
- Emits `EmergencyRefundTriggered`.

10. `getMaxRefundable(address)`
- Returns:
  - `totalDonated - withdrawnShare - totalRefunded`
- Protects against over-refund.

11. `getDonorCount()`
- Returns donor list size.

12. `getVoteWeight(voteId, donorAddr)`
- Returns snapshotted vote weight for donor.

13. `canClaimDissenterRefund(donorAddr)`
- UI helper:
  - checks latest passed vote existence
  - denies in `RefundMode`, `Cancelled`, `Successful`
  - requires donor voted no
  - requires donor has refundable amount

## 4) Frontend Implementation

### 4.1 App Shell and Routing

File: `Frontend/src/App.jsx`

Routes:
- `/` -> campaign list
- `/create` -> create campaign
- `/campaign/:address` -> campaign detail

Header:
- project title
- wallet connect status component

### 4.2 Wallet Context

File: `Frontend/src/contexts/WalletContext.jsx`

Features:
- Connect wallet via MetaMask (`eth_requestAccounts`)
- Track:
  - `provider`
  - `address`
  - `chainId`
  - `isConnected`
  - `isConnecting`
  - `error`
- Handles account and chain changes.

### 4.3 Contract Config and ABI

File: `Frontend/src/config/contracts.js`

Defines:
- network constants
- factory and campaign ABIs
- campaign state labels
- IPFS/Filebase env configs:
  - `VITE_IPFS_GATEWAY`
  - `VITE_IPFS_RPC_URL`
  - `VITE_IPFS_RPC_AUTH`

### 4.4 Factory Service

File: `Frontend/src/services/factoryService.js`

Functions:
- `getFactoryContract()`
- `fetchCampaignAddresses()`
- `createCampaign()`
- `fetchCampaignSummaries()`

Behavior:
- validates `VITE_FACTORY_ADDRESS`
- fetches campaign-level summary data for list UI

### 4.5 Campaign Service

File: `Frontend/src/services/campaignService.js`

Read function:
- `fetchCampaignDetails()`
  - pulls campaign metadata, balances, donor info
  - active vote details
  - complete vote history from `1..nextVoteId`
  - refund eligibility flags

Write functions:
- `donateToCampaign`
- `submitProof`
- `castVote`
- `finalizeVote`
- `withdrawApproved`
- `claimRefund`
- `claimDissenterRefund`
- `triggerEmergencyRefund`
- `cancelCampaign`

### 4.6 Filebase IPFS Service

File: `Frontend/src/services/ipfsService.js`

Current mode:
- Filebase-only upload path in app logic.

Flow:
- checks required env (`VITE_IPFS_RPC_URL`, `VITE_IPFS_RPC_AUTH`)
- posts multipart file to:
  - `/api/v0/add?pin=true&cid-version=1&progress=false`
- uses `Authorization: Bearer <VITE_IPFS_RPC_AUTH>`
- timeout at 60s
- parses final line JSON and extracts CID

### 4.7 Campaign List Page

File: `Frontend/src/pages/CampaignList.jsx`

Features:
- loads campaigns from factory
- refresh button
- error handling
- empty state:
  - "No campaigns yet. Create the first one."

### 4.8 Create Campaign Page

File: `Frontend/src/pages/CreateCampaign.jsx`

Inputs:
- title
- description
- initial goal (ETH)
- emergency timeout (days)

On submit:
- converts goal to wei
- converts days to seconds
- calls factory create function

### 4.9 Campaign Detail Page

File: `Frontend/src/pages/CampaignDetail.jsx`

Implemented functionality:
- campaign info and donor info display
- donation action
- proof upload to Filebase + proof hash manual input
- open vote with requested amount and voting duration
- vote agree/disagree
- finalize vote (creator only visible)
- withdraw approved amount (creator)
- claim refund in refund mode
- claim dissenter refund for eligible no-voters
- cancel campaign (creator)
- emergency refund trigger (creator)
- active vote panel
- proof history panel (all votes)

UX behavior updates:
- show "Voting success: you can withdraw X"
- hide invalid actions based on role and eligibility
- shows clear transaction/upload status messages

## 5) Testing Status

Backend tests cover:
- factory empty/deploy/multiple campaigns
- donation and donor tracking
- vote snapshot isolation
- one active vote rule
- quorum+majority and auto-pass
- creator early finalize
- withdrawal flow
- refund mode partial refunds
- no-voter refund after passed vote
- cancellation constraints
- emergency refund rules (creator-only in dev mode)

Current status:
- all tests passing (`16 passing` at latest run)

## 6) Environment Configuration

### Backend `.env`

Required:
- `ALCHEMY_RPC_URL`
- `PRIVATE_KEY`

### Frontend `.env`

Required:
- `VITE_FACTORY_ADDRESS`
- `VITE_IPFS_GATEWAY`
- `VITE_IPFS_RPC_URL`
- `VITE_IPFS_RPC_AUTH`

## 7) Known Limitations

1. Gas scalability
- Contract loops over all donors during snapshot/withdraw/cancel.
- Large donor count can become expensive.

2. Frontend secret exposure risk
- Filebase auth is currently placed in frontend env.
- For production, upload should go through secured backend/proxy.

3. Creator force-finalize (dev behavior)
- Useful for testing but not ideal for strict governance production flow.

4. Creator emergency force-refund (dev behavior)
- Immediate creator-triggered refund mode bypasses timeout in current version.

5. Whale influence
- Vote power is donation-weighted, so large donors can dominate outcomes.

6. No anti-sybil controls
- No KYC/identity constraints in current decentralized model.

7. No minimum/maximum voting duration guard
- Creator controls duration; too short windows are possible.

8. Refund model complexity
- Dissenter refund behavior after pass is custom to your current requirement and may need policy refinement later.

## 8) Suggested Improvements (Next Version)

If implemented, project quality and safety improve significantly:

1. Production governance mode toggle
- Separate dev-mode and production-mode rules for finalize/emergency behavior.

2. Backend upload proxy for Filebase
- Keep API credentials server-side.

3. Indexing layer (The Graph or custom backend)
- Faster vote history/proof queries.

4. Gas optimization
- Reduce O(n) loops and move to claim-based accounting where possible.

5. Better vote windows
- enforce min/max voting duration.

6. Event-driven UI refresh
- subscribe to events instead of polling/reloading full state.

7. Role-driven UI guards + tooltips
- explain why a button is hidden/disabled.

8. Enhanced analytics dashboard
- donor-wise refund history, vote breakdown, withdrawal timeline.

9. Contract verification and audit checklist
- verify on explorer + security checks before public release.

10. Optional future extensions
- stake-based governance (your planned v2),
- milestone templates,
- reputation scoring for creators.

## 9) Current Project Snapshot (Implemented So Far)

Implemented and working now:
- factory-based campaign creation
- proof-based weighted voting
- creator withdrawal only after approved vote
- creator dashboard visibility for approved withdrawal amount
- Filebase proof upload and CID usage
- proof visibility through active vote and vote history
- refund mode claims
- no-voter refund claims after passed vote
- totalRaised updates correctly after refunds
- creator-only finalize visibility in UI
- creator-only emergency force refund (dev mode)

This is a strong functional v1 with additional dev-mode controls to make testing and demonstration easier.
