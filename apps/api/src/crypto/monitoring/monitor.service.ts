import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../../groups/entities/group.entity';
import { User } from '../../users/entities/user.entity';
import { GroupWallet } from '../entities/group-wallet.entity';
import { UserWallet } from '../entities/user-wallet.entity';
import { CryptoTransfer, CryptoTransferStatus } from '../entities/crypto-transfer.entity';
import { IncomingCryptoTransfer } from '../crypto-client';

/**
 * Processes incoming crypto transfers from chain-monitoring webhooks.
 *
 * When a webhook arrives (Alchemy for EVM, TronGrid for Tron), this service:
 * 1. Looks up which user (or legacy group) the receiving address belongs to
 * 2. Deduplicates by (txHash, chain)
 * 3. Stores the transfer as 'unmatched' for the organiser to match
 */
@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);

  constructor(
    @InjectRepository(GroupWallet) private walletRepo: Repository<GroupWallet>,
    @InjectRepository(UserWallet) private userWalletRepo: Repository<UserWallet>,
    @InjectRepository(CryptoTransfer) private transferRepo: Repository<CryptoTransfer>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  /**
   * Process an incoming transfer parsed from a webhook.
   * Returns the stored transfer, or null if it was a duplicate or irrelevant.
   */
  async processIncoming(transfer: IncomingCryptoTransfer): Promise<CryptoTransfer | null> {
    // 1. Look up user_wallets first (new model), then fall back to group_wallets (legacy)
    const userWallet = await this.findUserWallet(transfer.toAddress);
    const groupWallet = userWallet ? null : await this.findGroupWallet(transfer.toAddress);

    if (!userWallet && !groupWallet) {
      this.logger.debug(`Ignoring transfer to unknown address ${transfer.toAddress}`);
      return null;
    }

    // 2. Deduplicate by (txHash, chain)
    const existing = await this.transferRepo.findOne({
      where: { txHash: transfer.txHash, chain: transfer.chain },
    });
    if (existing) {
      this.logger.debug(`Duplicate transfer ${transfer.txHash} on ${transfer.chain}`);
      return existing;
    }

    // 3. Build the transfer record
    let userId: string | null = null;
    let groupId: string | null = null;

    if (userWallet) {
      userId = userWallet.userId;
      // Auto-assign groupId if the admin has exactly one international group
      groupId = await this.autoAssignGroup(userWallet.userId);
    } else if (groupWallet) {
      groupId = groupWallet.groupId;
    }

    const entity = this.transferRepo.create({
      txHash: transfer.txHash,
      chain: transfer.chain,
      token: transfer.token,
      fromAddress: transfer.fromAddress,
      toAddress: transfer.toAddress,
      amount: transfer.amount,
      userId,
      groupId,
      status: CryptoTransferStatus.UNMATCHED,
      blockNumber: transfer.blockNumber != null ? String(transfer.blockNumber) : null,
      receivedAt: transfer.receivedAt,
      raw: transfer.raw,
    });

    const saved = await this.transferRepo.save(entity);
    this.logger.log(
      `Recorded ${transfer.token} transfer ${transfer.txHash} on ${transfer.chain}` +
      (userId ? ` for user ${userId}` : '') +
      (groupId ? ` (group ${groupId})` : '') +
      `: $${transfer.amount}`,
    );
    return saved;
  }

  /** Find a user wallet by address (case-insensitive for EVM, exact for Tron). */
  private async findUserWallet(address: string): Promise<UserWallet | null> {
    return (
      (await this.userWalletRepo.findOne({ where: { address: address.toLowerCase() } })) ??
      (await this.userWalletRepo.findOne({ where: { address } }))
    );
  }

  /** Find a legacy group wallet by address. */
  private async findGroupWallet(address: string): Promise<GroupWallet | null> {
    return (
      (await this.walletRepo.findOne({ where: { address: address.toLowerCase() } })) ??
      (await this.walletRepo.findOne({ where: { address } }))
    );
  }

  /**
   * If the admin (user) has exactly one international group, return its ID
   * so the transfer is auto-assigned. Otherwise return null.
   */
  private async autoAssignGroup(userId: string): Promise<string | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'organizationId'],
    });
    if (!user) return null;

    const intlGroups = await this.groupRepo.find({
      where: { organizationId: user.organizationId, scope: 'international' as any },
    });

    return intlGroups.length === 1 ? intlGroups[0].id : null;
  }
}
