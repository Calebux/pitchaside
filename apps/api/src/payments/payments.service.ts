import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Session } from '../sessions/entities/session.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    @InjectRepository(Session) private sessionsRepo: Repository<Session>,
  ) {}

  async create(dto: CreatePaymentDto, organizationId: string) {
    // Verify session belongs to org
    const session = await this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoin('session.group', 'group')
      .where('session.id = :id', { id: dto.sessionId })
      .andWhere('group.organizationId = :organizationId', { organizationId })
      .getOne();
    if (!session) throw new NotFoundException('Session not found');

    const payment = this.paymentsRepo.create(dto);
    if (dto.status === PaymentStatus.PAID) {
      payment.paidAt = new Date();
    }
    const saved = await this.paymentsRepo.save(payment);

    await this.recalculateSessionTotal(dto.sessionId);
    return saved;
  }

  async markAsPaid(id: string, organizationId: string, markedBy?: string) {
    const payment = await this.paymentsRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.session', 'session')
      .innerJoin('session.group', 'group')
      .where('payment.id = :id', { id })
      .andWhere('group.organizationId = :organizationId', { organizationId })
      .getOne();
    if (!payment) throw new NotFoundException('Payment not found');

    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();
    if (markedBy) payment.markedBy = markedBy;
    const saved = await this.paymentsRepo.save(payment);

    await this.recalculateSessionTotal(payment.sessionId);
    return saved;
  }

  async findBySession(sessionId: string, organizationId: string) {
    return this.paymentsRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.session', 'session')
      .innerJoin('session.group', 'group')
      .leftJoinAndSelect('payment.player', 'player')
      .where('payment.sessionId = :sessionId', { sessionId })
      .andWhere('group.organizationId = :organizationId', { organizationId })
      .getMany();
  }

  async findByPlayer(playerId: string, organizationId: string) {
    return this.paymentsRepo
      .createQueryBuilder('payment')
      .innerJoinAndSelect('payment.session', 'session')
      .innerJoinAndSelect('session.group', 'group')
      .where('payment.playerId = :playerId', { playerId })
      .andWhere('group.organizationId = :organizationId', { organizationId })
      .orderBy('payment.createdAt', 'DESC')
      .getMany();
  }

  async waive(id: string, organizationId: string, waivedBy?: string) {
    const payment = await this.paymentsRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.session', 'session')
      .innerJoin('session.group', 'group')
      .where('payment.id = :id', { id })
      .andWhere('group.organizationId = :organizationId', { organizationId })
      .getOne();
    if (!payment) throw new NotFoundException('Payment not found');

    payment.status = PaymentStatus.WAIVED;
    if (waivedBy) payment.markedBy = waivedBy;
    const saved = await this.paymentsRepo.save(payment);

    await this.recalculateSessionTotal(payment.sessionId);
    return saved;
  }

  async bulkMarkAsPaid(paymentIds: string[], organizationId: string, markedBy?: string) {
    const payments: Payment[] = [];
    const sessionIds = new Set<string>();

    for (const id of paymentIds) {
      const payment = await this.paymentsRepo
        .createQueryBuilder('payment')
        .innerJoin('payment.session', 'session')
        .innerJoin('session.group', 'group')
        .where('payment.id = :id', { id })
        .andWhere('group.organizationId = :organizationId', { organizationId })
        .getOne();
      if (!payment) throw new NotFoundException(`Payment ${id} not found`);

      payment.status = PaymentStatus.PAID;
      payment.paidAt = new Date();
      if (markedBy) payment.markedBy = markedBy;
      payments.push(payment);
      sessionIds.add(payment.sessionId);
    }

    const saved = await this.paymentsRepo.save(payments);

    for (const sessionId of sessionIds) {
      await this.recalculateSessionTotal(sessionId);
    }

    return saved;
  }

  private async recalculateSessionTotal(sessionId: string) {
    const payments = await this.paymentsRepo.find({
      where: { sessionId, status: PaymentStatus.PAID },
    });
    const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    await this.sessionsRepo.update(sessionId, { collectedAmount: total });
  }
}
