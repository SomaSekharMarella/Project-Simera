// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Campaign.sol";

contract CampaignFactory {
    address[] public campaigns;

    event CampaignCreated(
        address indexed campaignAddress,
        address indexed creator,
        string title,
        uint256 initialGoal,
        uint256 emergencyTimeout
    );

    function createCampaign(
        string calldata title,
        string calldata description,
        uint256 initialGoal,
        uint256 emergencyTimeout
    ) external returns (address) {
        Campaign campaign = new Campaign(title, description, initialGoal, emergencyTimeout, msg.sender);
        address campaignAddress = address(campaign);

        campaigns.push(campaignAddress);

        emit CampaignCreated(campaignAddress, msg.sender, title, initialGoal, emergencyTimeout);
        return campaignAddress;
    }

    function getCampaigns() external view returns (address[] memory) {
        return campaigns;
    }

    function getCampaignCount() external view returns (uint256) {
        return campaigns.length;
    }
}
