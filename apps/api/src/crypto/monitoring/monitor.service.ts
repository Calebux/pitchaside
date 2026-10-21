import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupWallet } from '../entities/group-wallet.entity';
import { CryptoTransfer, CryptoTransferStatus } from '../entities/crypto-transfer.entity';
import { IncomingCryptoTransfer } from '../crypto-client';

/**
 * Processes incoming crypto transfers from chain-monitoring webhooks.
 *
 * When a webhook arrives (Alchemy for EVM, TronGrid for Tron), this service:
 * 1. Looks up which group the receiving address belongs to
 * 2. Deduplicates by (txHash, chain)
 * 3. Stores the transfer as 'unmatched' for the organiser to match
 */
@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);

  constructor(
    @InjectRepository(GroupWallet) private walletRepo: Repository<GroupWallet>,
    @InjectRepository(CryptoTransfer) private transferRepo: Repository<CryptoTransfer>,
  ) {}

  /**
   * Process an incoming transfer parsed from a webhook.
   * Returns the stored transfer, or null if it was a duplicate or irrelevant.
   */
  async processIncoming(transfer: IncomingCryptoTransfer): Promise<CryptoTransfer | null> {
    // 1. Find the group wallet for this address
    const wallet = await this.walletRepo.findOne({
      where: { address: transfer.toAddress.toLowerCase() },
    });
    // Also try the original case (Tron addresses are base58, not lowercased)
    const walletExact = wallet ?? await this.walletRepo.findOne({
      where: { address: transfer.toAddress },
    });

    if (!walletExact) {
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

    // 3. Store as unmatched
    const entity = this.transferRepo.create({
      txHash: transfer.txHash,
      chain: transfer.chain,
      token: transfer.token,
      fromAddress: transfer.fromAddress,
      toAddress: transfer.toAddress,
      amount: transfer.amount,
      groupId: walletExact.groupId,
      status: CryptoTransferStatus.UNMATCHED,
      blockNumber: transfer.blockNumber != null ? String(transfer.blockNumber) : null,
      receivedAt: transfer.receivedAt,
      raw: transfer.raw,
    });

    const saved = await this.transferRepo.save(entity);
    this.logger.log(`Recorded ${transfer.token} transfer ${transfer.txHash} on ${transfer.chain} for group ${walletExact.groupId}: $${transfer.amount}`);
    return saved;
  }
}
