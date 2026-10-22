import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("PaymentReceiver", function () {
  async function deployFixture() {
    const [owner, admin, payer, other] = await ethers.getSigners();

    // Deploy mock tokens (6 decimals like USDT/USDC)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdt = await MockERC20.deploy("Tether USD", "USDT", 6);
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const unsupported = await MockERC20.deploy("Random Token", "RND", 18);

    // Deploy PaymentReceiver
    const PaymentReceiver = await ethers.getContractFactory("PaymentReceiver");
    const receiver = await PaymentReceiver.deploy(owner.address);

    // Register admin and tokens
    await receiver.registerAdmin(admin.address);
    await receiver.registerToken(await usdt.getAddress());
    await receiver.registerToken(await usdc.getAddress());

    // Mint tokens to payer and approve
    const mintAmount = ethers.parseUnits("10000", 6);
    await usdt.mint(payer.address, mintAmount);
    await usdc.mint(payer.address, mintAmount);
    await usdt.connect(payer).approve(await receiver.getAddress(), ethers.MaxUint256);
    await usdc.connect(payer).approve(await receiver.getAddress(), ethers.MaxUint256);

    return { receiver, usdt, usdc, unsupported, owner, admin, payer, other };
  }

  // ── pay() ──────────────────────────────────────────────────────────

  describe("pay()", function () {
    it("transfers tokens and emits PaymentReceived", async function () {
      const { receiver, usdt, admin, payer } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("100", 6);

      const tx = receiver.connect(payer).pay(admin.address, await usdt.getAddress(), amount);

      await expect(tx)
        .to.emit(receiver, "PaymentReceived")
        .withArgs(
          admin.address,
          payer.address,
          await usdt.getAddress(),
          amount,
          // timestamp — we just check it's nonzero via anyValue
          (v: bigint) => v > 0n
        );

      // Contract should hold the tokens
      expect(await usdt.balanceOf(await receiver.getAddress())).to.equal(amount);
    });

    it("reverts for unregistered admin", async function () {
      const { receiver, usdt, payer, other } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("100", 6);

      await expect(
        receiver.connect(payer).pay(other.address, await usdt.getAddress(), amount)
      ).to.be.revertedWithCustomError(receiver, "AdminNotRegistered");
    });

    it("reverts for unsupported token", async function () {
      const { receiver, unsupported, admin, payer } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("100", 18);
      await unsupported.mint(payer.address, amount);
      await unsupported.connect(payer).approve(await receiver.getAddress(), ethers.MaxUint256);

      await expect(
        receiver.connect(payer).pay(admin.address, await unsupported.getAddress(), amount)
      ).to.be.revertedWithCustomError(receiver, "TokenNotSupported");
    });

    it("reverts when paused", async function () {
      const { receiver, usdt, admin, payer, owner } = await loadFixture(deployFixture);
      await receiver.connect(owner).pause();
      const amount = ethers.parseUnits("100", 6);

      await expect(
        receiver.connect(payer).pay(admin.address, await usdt.getAddress(), amount)
      ).to.be.revertedWithCustomError(receiver, "EnforcedPause");
    });

    it("reverts on zero amount", async function () {
      const { receiver, usdt, admin, payer } = await loadFixture(deployFixture);

      await expect(
        receiver.connect(payer).pay(admin.address, await usdt.getAddress(), 0)
      ).to.be.revertedWithCustomError(receiver, "ZeroAmount");
    });
  });

  // ── withdraw() ────────────────────────────────────────────────────

  describe("withdraw()", function () {
    it("owner withdraws accumulated tokens", async function () {
      const { receiver, usdt, admin, payer, owner, other } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("500", 6);

      // First, make a payment so the contract has tokens
      await receiver.connect(payer).pay(admin.address, await usdt.getAddress(), amount);

      const withdrawAmount = ethers.parseUnits("200", 6);
      const tx = receiver.connect(owner).withdraw(await usdt.getAddress(), withdrawAmount, other.address);

      await expect(tx)
        .to.emit(receiver, "Withdrawal")
        .withArgs(await usdt.getAddress(), other.address, withdrawAmount);

      expect(await usdt.balanceOf(other.address)).to.equal(withdrawAmount);
    });

    it("non-owner reverts", async function () {
      const { receiver, usdt, other } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("100", 6);

      await expect(
        receiver.connect(other).withdraw(await usdt.getAddress(), amount, other.address)
      ).to.be.revertedWithCustomError(receiver, "OwnableUnauthorizedAccount");
    });
  });

  // ── withdrawAll() ─────────────────────────────────────────────────

  describe("withdrawAll()", function () {
    it("drains full token balance", async function () {
      const { receiver, usdt, admin, payer, owner, other } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("1000", 6);

      await receiver.connect(payer).pay(admin.address, await usdt.getAddress(), amount);

      await expect(
        receiver.connect(owner).withdrawAll(await usdt.getAddress(), other.address)
      )
        .to.emit(receiver, "Withdrawal")
        .withArgs(await usdt.getAddress(), other.address, amount);

      expect(await usdt.balanceOf(await receiver.getAddress())).to.equal(0);
      expect(await usdt.balanceOf(other.address)).to.equal(amount);
    });
  });

  // ── Admin management ──────────────────────────────────────────────

  describe("registerAdmin() / deregisterAdmin()", function () {
    it("only owner can register, emits AdminRegistered", async function () {
      const { receiver, owner, other } = await loadFixture(deployFixture);

      await expect(receiver.connect(owner).registerAdmin(other.address))
        .to.emit(receiver, "AdminRegistered")
        .withArgs(other.address);

      expect(await receiver.registeredAdmins(other.address)).to.be.true;
    });

    it("non-owner cannot register", async function () {
      const { receiver, other } = await loadFixture(deployFixture);

      await expect(
        receiver.connect(other).registerAdmin(other.address)
      ).to.be.revertedWithCustomError(receiver, "OwnableUnauthorizedAccount");
    });

    it("only owner can deregister, emits AdminDeregistered", async function () {
      const { receiver, owner, admin } = await loadFixture(deployFixture);

      await expect(receiver.connect(owner).deregisterAdmin(admin.address))
        .to.emit(receiver, "AdminDeregistered")
        .withArgs(admin.address);

      expect(await receiver.registeredAdmins(admin.address)).to.be.false;
    });
  });

  // ── registerAdminsBatch() ─────────────────────────────────────────

  describe("registerAdminsBatch()", function () {
    it("registers multiple admins", async function () {
      const { receiver, owner } = await loadFixture(deployFixture);
      const signers = await ethers.getSigners();
      const addrs = [signers[4].address, signers[5].address, signers[6].address];

      const tx = await receiver.connect(owner).registerAdminsBatch(addrs);

      for (const addr of addrs) {
        await expect(tx).to.emit(receiver, "AdminRegistered").withArgs(addr);
        expect(await receiver.registeredAdmins(addr)).to.be.true;
      }
    });

    it("reverts if any address is zero", async function () {
      const { receiver, owner, other } = await loadFixture(deployFixture);

      await expect(
        receiver.connect(owner).registerAdminsBatch([other.address, ethers.ZeroAddress])
      ).to.be.revertedWithCustomError(receiver, "ZeroAddress");
    });
  });

  // ── Token management ──────────────────────────────────────────────

  describe("registerToken() / deregisterToken()", function () {
    it("only owner can register token, emits TokenRegistered", async function () {
      const { receiver, owner, unsupported } = await loadFixture(deployFixture);
      const tokenAddr = await unsupported.getAddress();

      await expect(receiver.connect(owner).registerToken(tokenAddr))
        .to.emit(receiver, "TokenRegistered")
        .withArgs(tokenAddr);

      expect(await receiver.supportedTokens(tokenAddr)).to.be.true;
    });

    it("non-owner cannot register token", async function () {
      const { receiver, other, unsupported } = await loadFixture(deployFixture);

      await expect(
        receiver.connect(other).registerToken(await unsupported.getAddress())
      ).to.be.revertedWithCustomError(receiver, "OwnableUnauthorizedAccount");
    });

    it("only owner can deregister token, emits TokenDeregistered", async function () {
      const { receiver, owner, usdt } = await loadFixture(deployFixture);
      const tokenAddr = await usdt.getAddress();

      await expect(receiver.connect(owner).deregisterToken(tokenAddr))
        .to.emit(receiver, "TokenDeregistered")
        .withArgs(tokenAddr);

      expect(await receiver.supportedTokens(tokenAddr)).to.be.false;
    });
  });

  // ── Pausable ──────────────────────────────────────────────────────

  describe("pause() / unpause()", function () {
    it("only owner can pause", async function () {
      const { receiver, other } = await loadFixture(deployFixture);

      await expect(
        receiver.connect(other).pause()
      ).to.be.revertedWithCustomError(receiver, "OwnableUnauthorizedAccount");
    });

    it("only owner can unpause", async function () {
      const { receiver, owner, other } = await loadFixture(deployFixture);
      await receiver.connect(owner).pause();

      await expect(
        receiver.connect(other).unpause()
      ).to.be.revertedWithCustomError(receiver, "OwnableUnauthorizedAccount");
    });

    it("owner can pause and unpause", async function () {
      const { receiver, owner, usdt, admin, payer } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("100", 6);

      await receiver.connect(owner).pause();

      await expect(
        receiver.connect(payer).pay(admin.address, await usdt.getAddress(), amount)
      ).to.be.revertedWithCustomError(receiver, "EnforcedPause");

      await receiver.connect(owner).unpause();

      // Should work again after unpause
      await expect(
        receiver.connect(payer).pay(admin.address, await usdt.getAddress(), amount)
      ).to.not.be.reverted;
    });
  });
});
