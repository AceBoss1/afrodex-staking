// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
  AfroDexGovernanceReward.sol
  Monolithic contract for:
   - Reward Pool (funding)
   - Batch payouts (admin)
   - Manual claim (user + backend-signed)
   - Governance vote recording (events)
   - Tier registry (on-chain read)
   - Proposal lifecycle anchoring (register/close)
   - Treasury transparency (events)
*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AfroDexGovernanceReward is Ownable, ReentrancyGuard {
  using ECDSA for bytes32;

  // Token used for payouts (AfroX)
  IERC20 public immutable token;

  // Backend signer for granting manual claim authorizations
  address public backendSigner;

  // Track claimed totals per wallet (prevents double-claim beyond authorization)
  mapping(address => uint256) public claimedTotal;

  // Used nonces per wallet for manual claim replay protection (can be sequential)
  mapping(address => mapping(uint256 => bool)) public usedNonce;

  // Tier registry (lightweight)
  mapping(address => uint8) public tierOf; // 0 = none, 1=Cadet, 2=Captain, etc.

  // Proposal lifecycle anchoring
  struct Proposal {
    bytes32 metadataHash; // hash of off-chain proposal data (JSON, IPFS, etc)
    uint256 startTimestamp;
    uint256 endTimestamp;
    bool closed;
  }
  mapping(uint256 => Proposal) public proposals;

  // Events
  event TreasuryFunded(address indexed from, uint256 amount);
  event TreasuryWithdrawn(address indexed to, uint256 amount, string purpose);

  event BatchPayoutExecuted(address indexed executor, uint256 totalRecipients, uint256 totalAmount);
  event PayoutSent(address indexed recipient, uint256 amount);

  event ManualClaimExecuted(address indexed claimant, uint256 amount, uint256 nonce, bytes signature);

  event VoteRecorded(uint256 indexed proposalId, address indexed wallet, uint256 weight);
  event ProposalRegistered(uint256 indexed proposalId, bytes32 metadataHash, uint256 start, uint256 end);
  event ProposalClosed(uint256 indexed proposalId);

  event TierUpdated(address indexed wallet, uint8 tier, address indexed updatedBy);

  // Limits / flags
  uint256 public maxBatchRecipients = 500; // admin adjustable (safety)
  uint256 public minBatchInterval = 0; // placeholder if you want rate-limits

  // Reentrancy guard covers transfer flows
  constructor(IERC20 _token, address _backendSigner) {
    require(address(_token) != address(0), "Invalid token");
    require(_backendSigner != address(0), "Invalid signer");
    token = _token;
    backendSigner = _backendSigner;
  }

  // --------------------
  // Admin / Owner
  // --------------------

  /// @notice set backend signer (owner only)
  function setBackendSigner(address newSigner) external onlyOwner {
    require(newSigner != address(0), "zero signer");
    backendSigner = newSigner;
  }

  /// @notice change maximum recipients per batch (owner only)
  function setMaxBatchRecipients(uint256 m) external onlyOwner {
    require(m > 0, "invalid");
    maxBatchRecipients = m;
  }

  /// @notice owner can withdraw tokens from contract for treasury usage (transparent via event)
  function withdrawToTreasury(address to, uint256 amount, string calldata purpose) external onlyOwner nonReentrant {
    require(to != address(0), "invalid recipient");
    require(amount > 0, "invalid amount");
    require(token.balanceOf(address(this)) >= amount, "insufficient balance");
    token.transfer(to, amount);
    emit TreasuryWithdrawn(to, amount, purpose);
  }

  /// @notice deposit tokens into contract reward pool (owner or team can call; user may also transfer tokens directly)
  function fundPool(uint256 amount) external nonReentrant {
    require(amount > 0, "invalid amount");
    // pulls tokens from caller — requires approval
    bool ok = token.transferFrom(msg.sender, address(this), amount);
    require(ok, "transferFrom failed");
    emit TreasuryFunded(msg.sender, amount);
  }

  // --------------------
  // Batch payouts
  // --------------------

  /// @notice Execute a batch payout. onlyOwner (admin) calls with arrays of recipients + amounts.
  /// Emits PayoutSent per recipient and a BatchPayoutExecuted on completion.
  function executeBatchPayout(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner nonReentrant {
    uint256 n = recipients.length;
    require(n == amounts.length, "len mismatch");
    require(n > 0 && n <= maxBatchRecipients, "invalid recipients count");

    uint256 total = 0;
    for (uint256 i = 0; i < n; ++i) {
      total += amounts[i];
    }

    require(token.balanceOf(address(this)) >= total, "insufficient pool");

    // perform transfers
    for (uint256 i = 0; i < n; ++i) {
      address r = recipients[i];
      uint256 a = amounts[i];
      if (a == 0 || r == address(0)) {
        emit PayoutSent(r, 0);
        continue;
      }
      token.transfer(r, a);
      emit PayoutSent(r, a);
    }

    emit BatchPayoutExecuted(msg.sender, n, total);
  }

  // --------------------
  // Manual Claim (user gas paid; authorized by backend signature)
  // --------------------
  /*
    Signature scheme (off-chain by backendSigner):
      Signed message = keccak256(abi.encodePacked(chainId, address(this), claimant, amount, nonce))
      signature = sign(hash)
    Backend stores/returns (amount,nonce,signature) to claimant, who calls manualClaim(amount,nonce,signature)
  */

  function manualClaim(uint256 amount, uint256 nonce, bytes calldata signature) external nonReentrant {
    address claimant = msg.sender;
    require(amount > 0, "zero amount");
    require(!usedNonce[claimant][nonce], "nonce used");

    // reconstruct the signed hash
    bytes32 hash = keccak256(abi.encodePacked(block.chainid, address(this), claimant, amount, nonce));
    bytes32 ethSigned = hash.toEthSignedMessageHash();
    address signer = ethSigned.recover(signature);
    require(signer == backendSigner, "invalid signature");

    // mark nonce as used to prevent replay
    usedNonce[claimant][nonce] = true;

    // ensure contract has tokens available
    require(token.balanceOf(address(this)) >= amount, "insufficient pool");

    // update claimedTotal and transfer tokens
    claimedTotal[claimant] += amount;
    token.transfer(claimant, amount);

    emit ManualClaimExecuted(claimant, amount, nonce, signature);
  }

  // --------------------
  // Governance Vote Recording (events)
  // --------------------

  /// @notice Record a vote (backend or admin should call this so votes are anchored on-chain).
  /// It simply emits an event for auditability. Optionally restrict to owner/backend if desired.
  function recordVote(uint256 proposalId, address wallet, uint256 weight) external onlyOwner {
    // Optionally: allow backend signer as actor if you want backend to call as non-owner
    emit VoteRecorded(proposalId, wallet, weight);
  }

  // --------------------
  // Proposal lifecycle
  // --------------------
  function registerProposal(uint256 proposalId, bytes32 metadataHash, uint256 startTimestamp, uint256 endTimestamp) external onlyOwner {
    require(proposals[proposalId].metadataHash == bytes32(0), "exists");
    require(startTimestamp < endTimestamp, "invalid window");
    proposals[proposalId] = Proposal({
      metadataHash: metadataHash,
      startTimestamp: startTimestamp,
      endTimestamp: endTimestamp,
      closed: false
    });
    emit ProposalRegistered(proposalId, metadataHash, startTimestamp, endTimestamp);
  }

  function closeProposal(uint256 proposalId) external onlyOwner {
    Proposal storage p = proposals[proposalId];
    require(p.metadataHash != bytes32(0), "not exists");
    require(!p.closed, "already closed");
    p.closed = true;
    emit ProposalClosed(proposalId);
  }

  // --------------------
  // Tier registry (owner/backend updates tiers)
  // --------------------
  function updateTier(address wallet, uint8 tier) external onlyOwner {
    require(wallet != address(0), "invalid");
    tierOf[wallet] = tier;
    emit TierUpdated(wallet, tier, msg.sender);
  }

  // --------------------
  // Misc / View Helpers
  // --------------------

  /// @notice Check available balance in reward pool
  function poolBalance() external view returns (uint256) {
    return token.balanceOf(address(this));
  }

  // --------------------
  // Emergency / Recover
  // --------------------

  /// @notice Recover accidentally sent ERC20 tokens that are NOT the reward token (owner only)
  function recoverERC20(IERC20 erc, address to, uint256 amount) external onlyOwner {
    require(address(erc) != address(token), "not allowed for reward token");
    require(to != address(0), "invalid");
    erc.transfer(to, amount);
  }
}
