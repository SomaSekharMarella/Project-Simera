// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Campaign {
    enum CampaignState {
        Active,
        VotingActive,
        RefundMode,
        Successful,
        Cancelled
    }

    struct Donor {
        uint256 totalDonated;
        uint256 totalRefunded;
        uint256 withdrawnShare;
        bool exists;
    }

    struct VoteRequest {
        uint256 id;
        string proofIpfsHash;
        uint256 requestedAmount;
        uint256 snapshotTotalRaised;
        uint256 yesWeight;
        uint256 noWeight;
        uint256 participationWeight;
        uint256 startAt;
        uint256 endAt;
        bool resolved;
        bool passed;
    }

    string public title;
    string public description;
    address public immutable creator;
    uint256 public immutable initialGoal;
    uint256 public immutable emergencyTimeout;

    uint256 public totalRaised;
    uint256 public totalWithdrawn;
    uint256 public lastActivityAt;
    uint256 public nextVoteId;
    uint256 public activeVoteId;
    uint256 public pendingApprovedWithdrawal;
    uint256 public pendingApprovedVoteId;

    CampaignState public state;

    mapping(address => Donor) public donors;
    address[] public donorList;
    mapping(uint256 => VoteRequest) public votes;
    mapping(uint256 => mapping(address => uint256)) public voteWeights;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public votedNo;

    uint256 public latestPassedVoteId;

    bool private locked;

    event Donated(address indexed donor, uint256 amount, uint256 totalRaised);
    event ProofSubmitted(
        uint256 indexed voteId,
        string proofIpfsHash,
        uint256 requestedAmount,
        uint256 snapshotTotalRaised,
        uint256 startAt,
        uint256 endAt
    );
    event Voted(uint256 indexed voteId, address indexed voter, bool support, uint256 weight);
    event VoteFinalized(
        uint256 indexed voteId,
        bool passed,
        bool autoPassed,
        uint256 yesWeight,
        uint256 noWeight,
        uint256 participationWeight
    );
    event WithdrawalExecuted(uint256 indexed voteId, uint256 amount);
    event RefundClaimed(address indexed donor, uint256 amount);
    event DissenterRefundClaimed(address indexed donor, uint256 indexed voteId, uint256 amount);
    event CampaignCancelled();
    event EmergencyRefundTriggered();
    event CampaignStateChanged(CampaignState newState);

    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "Reentrancy");
        locked = true;
        _;
        locked = false;
    }

    constructor(
        string memory _title,
        string memory _description,
        uint256 _initialGoal,
        uint256 _emergencyTimeout,
        address _creator
    ) {
        require(_initialGoal > 0, "Goal must be > 0");
        require(_emergencyTimeout > 0, "Timeout must be > 0");
        require(_creator != address(0), "Invalid creator");

        title = _title;
        description = _description;
        creator = _creator;
        initialGoal = _initialGoal;
        emergencyTimeout = _emergencyTimeout;
        state = CampaignState.Active;
        lastActivityAt = block.timestamp;
    }

    receive() external payable {
        donate();
    }

    function donate() public payable {
        require(state == CampaignState.Active || state == CampaignState.VotingActive, "Donations closed");
        require(msg.value > 0, "Amount must be > 0");

        Donor storage donor = donors[msg.sender];
        if (!donor.exists) {
            donor.exists = true;
            donorList.push(msg.sender);
        }

        donor.totalDonated += msg.value;
        totalRaised += msg.value;
        lastActivityAt = block.timestamp;

        emit Donated(msg.sender, msg.value, totalRaised);
    }

    function submitProofAndOpenVote(
        string calldata proofIpfsHash,
        uint256 requestedAmount,
        uint256 votingDurationSeconds
    ) external onlyCreator {
        require(state == CampaignState.Active, "Campaign not active");
        require(activeVoteId == 0, "Vote already active");
        require(pendingApprovedWithdrawal == 0, "Claim approved withdrawal first");
        require(bytes(proofIpfsHash).length > 0, "Empty proof hash");
        require(requestedAmount > 0, "Requested amount must be > 0");
        require(votingDurationSeconds > 0, "Voting duration must be > 0");

        uint256 maxPerProof = (initialGoal * 35) / 100;
        require(requestedAmount <= maxPerProof, "Request exceeds 35% of initial goal");
        require(requestedAmount <= address(this).balance, "Insufficient campaign balance");

        nextVoteId += 1;
        uint256 voteId = nextVoteId;
        activeVoteId = voteId;

        VoteRequest storage vr = votes[voteId];
        vr.id = voteId;
        vr.proofIpfsHash = proofIpfsHash;
        vr.requestedAmount = requestedAmount;
        vr.snapshotTotalRaised = totalRaised;
        vr.startAt = block.timestamp;
        vr.endAt = block.timestamp + votingDurationSeconds;

        for (uint256 i = 0; i < donorList.length; i++) {
            address donorAddr = donorList[i];
            uint256 weight = donors[donorAddr].totalDonated - donors[donorAddr].totalRefunded;
            voteWeights[voteId][donorAddr] = weight;
        }

        state = CampaignState.VotingActive;
        lastActivityAt = block.timestamp;

        emit CampaignStateChanged(state);
        emit ProofSubmitted(voteId, proofIpfsHash, requestedAmount, vr.snapshotTotalRaised, vr.startAt, vr.endAt);
    }

    function castVote(bool support) external {
        uint256 voteId = activeVoteId;
        require(voteId != 0, "No active vote");

        VoteRequest storage vr = votes[voteId];
        require(block.timestamp < vr.endAt, "Voting ended");
        require(!hasVoted[voteId][msg.sender], "Already voted");

        uint256 weight = voteWeights[voteId][msg.sender];
        require(weight > 0, "No voting weight");

        hasVoted[voteId][msg.sender] = true;
        vr.participationWeight += weight;
        if (support) {
            vr.yesWeight += weight;
        } else {
            vr.noWeight += weight;
            votedNo[voteId][msg.sender] = true;
        }

        lastActivityAt = block.timestamp;
        emit Voted(voteId, msg.sender, support, weight);
    }

    function finalizeVote() public {
        uint256 voteId = activeVoteId;
        require(voteId != 0, "No active vote");

        VoteRequest storage vr = votes[voteId];
        bool creatorForcedFinalize = msg.sender == creator;
        require(creatorForcedFinalize || block.timestamp >= vr.endAt, "Voting still active");
        require(!vr.resolved, "Vote already resolved");

        bool autoPassed = vr.participationWeight == 0;
        bool passed = autoPassed;

        if (!autoPassed && vr.snapshotTotalRaised > 0) {
            bool majorityReached = (vr.yesWeight * 100) > (vr.snapshotTotalRaised * 50);
            bool quorumReached = (vr.participationWeight * 100) >= (vr.snapshotTotalRaised * 30);
            passed = majorityReached && quorumReached;
        }

        vr.resolved = true;
        vr.passed = passed;
        activeVoteId = 0;

        if (passed) {
            pendingApprovedWithdrawal = vr.requestedAmount;
            pendingApprovedVoteId = voteId;
            latestPassedVoteId = voteId;
            state = CampaignState.Active;
        } else {
            state = CampaignState.RefundMode;
        }

        lastActivityAt = block.timestamp;
        emit CampaignStateChanged(state);
        emit VoteFinalized(voteId, passed, autoPassed, vr.yesWeight, vr.noWeight, vr.participationWeight);
    }

    function withdrawApprovedAmount() external onlyCreator nonReentrant {
        require(pendingApprovedWithdrawal > 0, "No approved amount");
        require(state == CampaignState.Active, "Campaign not active");

        uint256 voteId = pendingApprovedVoteId;
        require(voteId != 0, "No approved vote");

        VoteRequest storage vr = votes[voteId];
        require(vr.resolved && vr.passed, "Approved vote missing");

        uint256 amount = pendingApprovedWithdrawal;
        require(amount <= address(this).balance, "Insufficient campaign balance");

        pendingApprovedWithdrawal = 0;
        pendingApprovedVoteId = 0;
        totalWithdrawn += amount;

        if (vr.snapshotTotalRaised > 0) {
            for (uint256 i = 0; i < donorList.length; i++) {
                address donorAddr = donorList[i];
                uint256 donorWeight = voteWeights[voteId][donorAddr];
                if (donorWeight > 0) {
                    uint256 share = (amount * donorWeight) / vr.snapshotTotalRaised;
                    donors[donorAddr].withdrawnShare += share;
                }
            }
        }

        (bool ok, ) = creator.call{value: amount}("");
        require(ok, "Transfer failed");

        if (address(this).balance == 0 && activeVoteId == 0 && state == CampaignState.Active) {
            state = CampaignState.Successful;
            emit CampaignStateChanged(state);
        }

        lastActivityAt = block.timestamp;
        emit WithdrawalExecuted(voteId, amount);
    }

    function claimRefund(uint256 amount) external nonReentrant {
        require(state == CampaignState.RefundMode, "Refund mode inactive");
        require(amount > 0, "Amount must be > 0");

        uint256 maxRefundable = getMaxRefundable(msg.sender);
        require(amount <= maxRefundable, "Exceeds max refundable");
        require(amount <= address(this).balance, "Insufficient contract balance");

        donors[msg.sender].totalRefunded += amount;
        totalRaised -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Refund transfer failed");

        lastActivityAt = block.timestamp;
        emit RefundClaimed(msg.sender, amount);
    }

    function claimDissenterRefund(uint256 amount) external nonReentrant {
        require(state != CampaignState.RefundMode, "Use refund mode claim");
        require(state != CampaignState.Cancelled, "Campaign cancelled");
        require(amount > 0, "Amount must be > 0");
        require(latestPassedVoteId != 0, "No approved vote yet");
        require(votedNo[latestPassedVoteId][msg.sender], "Only latest no-voters can claim");

        VoteRequest storage approvedVote = votes[latestPassedVoteId];
        require(approvedVote.resolved && approvedVote.passed, "Approved vote not resolved");

        uint256 maxRefundable = getMaxRefundable(msg.sender);
        require(amount <= maxRefundable, "Exceeds max refundable");
        require(amount <= address(this).balance, "Insufficient contract balance");

        donors[msg.sender].totalRefunded += amount;
        totalRaised -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Refund transfer failed");

        lastActivityAt = block.timestamp;
        emit DissenterRefundClaimed(msg.sender, latestPassedVoteId, amount);
    }

    function cancelCampaign() external onlyCreator nonReentrant {
        require(state == CampaignState.Active || state == CampaignState.VotingActive, "Cannot cancel now");
        require(totalWithdrawn == 0, "Cannot cancel after withdrawal");

        activeVoteId = 0;
        pendingApprovedWithdrawal = 0;
        pendingApprovedVoteId = 0;
        state = CampaignState.Cancelled;

        for (uint256 i = 0; i < donorList.length; i++) {
            address donorAddr = donorList[i];
            uint256 maxRefundable = getMaxRefundable(donorAddr);
            if (maxRefundable > 0) {
                donors[donorAddr].totalRefunded += maxRefundable;
                totalRaised -= maxRefundable;
                (bool ok, ) = donorAddr.call{value: maxRefundable}("");
                require(ok, "Auto refund transfer failed");
                emit RefundClaimed(donorAddr, maxRefundable);
            }
        }

        lastActivityAt = block.timestamp;
        emit CampaignStateChanged(state);
        emit CampaignCancelled();
    }

    function triggerEmergencyRefund() external onlyCreator {
        require(state == CampaignState.Active || state == CampaignState.VotingActive, "Cannot trigger now");

        // Creator can force emergency refund in development/testing mode.
        activeVoteId = 0;
        pendingApprovedWithdrawal = 0;
        pendingApprovedVoteId = 0;
        state = CampaignState.RefundMode;
        lastActivityAt = block.timestamp;

        emit CampaignStateChanged(state);
        emit EmergencyRefundTriggered();
    }

    function getMaxRefundable(address donorAddr) public view returns (uint256) {
        Donor memory donor = donors[donorAddr];
        uint256 spentPlusRefunded = donor.withdrawnShare + donor.totalRefunded;
        if (spentPlusRefunded >= donor.totalDonated) {
            return 0;
        }

        return donor.totalDonated - spentPlusRefunded;
    }

    function getDonorCount() external view returns (uint256) {
        return donorList.length;
    }

    function getVoteWeight(uint256 voteId, address donorAddr) external view returns (uint256) {
        return voteWeights[voteId][donorAddr];
    }

    function canClaimDissenterRefund(address donorAddr) external view returns (bool) {
        if (latestPassedVoteId == 0) {
            return false;
        }
        if (state == CampaignState.RefundMode || state == CampaignState.Cancelled || state == CampaignState.Successful) {
            return false;
        }
        if (!votedNo[latestPassedVoteId][donorAddr]) {
            return false;
        }
        return getMaxRefundable(donorAddr) > 0;
    }
}
