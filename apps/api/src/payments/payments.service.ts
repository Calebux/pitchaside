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

  async create(dto: CreatePaymentDto) {
    const payment = this.paymentsRepo.create(dto);
    if (dto.status === PaymentStatus.PAID) {
      payment.paidAt = new Date();
    }
    const saved = await this.paymentsRepo.save(payment);

    await this.recalculateSessionTotal(dto.sessionId);
    return saved;
  }

  async markAsPaid(id: string, markedBy?: string) {
    const payment = await this.paymentsRepo.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');

    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();
    if (markedBy) payment.markedBy = markedBy;
    const saved = await this.paymentsRepo.save(payment);

    await this.recalculateSessionTotal(payment.sessionId);
    return saved;
  }

  findBySession(sessionId: string) {
    return this.paymentsRepo.find({
      where: { sessionId },
      relations: ['player'],
    });
  }

  findByPlayer(playerId: string) {
    return this.paymentsRepo.find({
      where: { playerId },
      relations: ['session', 'session.group'],
      order: { createdAt: 'DESC' },
    });
  }

  private async recalculateSessionTotal(sessionId: string) {
    const payments = await this.paymentsRepo.find({
      where: { sessionId, status: PaymentStatus.PAID },
    });
    const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    await this.sessionsRepo.update(sessionId, { collectedAmount: total });
  }
}
