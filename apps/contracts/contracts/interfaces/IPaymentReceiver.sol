// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPaymentReceiver
 * @notice Interface for the PaymentReceiver contract — use for external
 *         consumers or to generate a minimal frontend ABI.
 */
interface IPaymentReceiver {
    // ── Errors ──
    error AdminNotRegistered(address admin);
    error TokenNotSupported(address token);
    error ZeroAmount();
    error ZeroAddress();

    // ── Events ──
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

    // ── Payment ──
    function pay(address admin, address token, uint256 amount) external;

    // ── Withdrawals ──
    function withdraw(address token, uint256 amount, address to) external;
    function withdrawAll(address token, address to) external;

    // ── Admin management ──
    function registerAdmin(address admin) external;
    function deregisterAdmin(address admin) external;
    function registerAdminsBatch(address[] calldata admins) external;

    // ── Token management ──
    function registerToken(address token) external;
    function deregisterToken(address token) external;

    // ── Pausable ──
    function pause() external;
    function unpause() external;

    // ── View ──
    function registeredAdmins(address admin) external view returns (bool);
    function supportedTokens(address token) external view returns (bool);
}
