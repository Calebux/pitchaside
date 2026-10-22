// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PaymentReceiver
 * @notice Receives USDT/USDC payments on behalf of registered admins and emits
 *         structured events for the backend monitor.  Owner can withdraw
 *         accumulated funds to an arbitrary destination.
 */
contract PaymentReceiver is Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ── Errors ──────────────────────────────────────────────────────────
    error AdminNotRegistered(address admin);
    error TokenNotSupported(address token);
    error ZeroAmount();
    error ZeroAddress();

    // ── Events ──────────────────────────────────────────────────────────
    event PaymentReceived(
        address indexed admin,
        address indexed payer,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    event Withdrawal(address indexed token, address indexed to, uint256 amount);
    event AdminRegistered(address indexed admin);
    event AdminDeregistered(address indexed admin);
    event TokenRegistered(address indexed token);
    event TokenDeregistered(address indexed token);

    // ── State ───────────────────────────────────────────────────────────
    mapping(address => bool) public registeredAdmins;
    mapping(address => bool) public supportedTokens;

    // ── Constructor ─────────────────────────────────────────────────────
    constructor(address initialOwner) Ownable(initialOwner) {}

    // ── Payment ─────────────────────────────────────────────────────────

    /**
     * @notice Pay on behalf of `admin` using an ERC-20 token.
     * @param admin  The registered admin receiving the payment credit.
     * @param token  The ERC-20 token being used (must be whitelisted).
     * @param amount The amount to transfer (in token decimals).
     */
    function pay(address admin, address token, uint256 amount) external whenNotPaused {
        if (!registeredAdmins[admin]) revert AdminNotRegistered(admin);
        if (!supportedTokens[token]) revert TokenNotSupported(token);
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit PaymentReceived(admin, msg.sender, token, amount, block.timestamp);
    }

    // ── Withdrawals ─────────────────────────────────────────────────────

    /**
     * @notice Withdraw `amount` of `token` to `to`.
     */
    function withdraw(address token, uint256 amount, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransfer(to, amount);

        emit Withdrawal(token, to, amount);
    }

    /**
     * @notice Withdraw the entire balance of `token` to `to`.
     */
    function withdrawAll(address token, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();

        IERC20(token).safeTransfer(to, balance);

        emit Withdrawal(token, to, balance);
    }

    // ── Admin management ────────────────────────────────────────────────

    function registerAdmin(address admin) external onlyOwner {
        if (admin == address(0)) revert ZeroAddress();
        registeredAdmins[admin] = true;
        emit AdminRegistered(admin);
    }

    function deregisterAdmin(address admin) external onlyOwner {
        registeredAdmins[admin] = false;
        emit AdminDeregistered(admin);
    }

    function registerAdminsBatch(address[] calldata admins) external onlyOwner {
        for (uint256 i = 0; i < admins.length; i++) {
            if (admins[i] == address(0)) revert ZeroAddress();
            registeredAdmins[admins[i]] = true;
            emit AdminRegistered(admins[i]);
        }
    }

    // ── Token management ────────────────────────────────────────────────

    function registerToken(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        supportedTokens[token] = true;
        emit TokenRegistered(token);
    }

    function deregisterToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        emit TokenDeregistered(token);
    }

    // ── Pausable ────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
