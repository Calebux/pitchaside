import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Session } from '../sessions/entities/session.entity';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentsRepo: Record<string, jest.Mock>;
  let sessionsRepo: Record<string, jest.Mock>;

  const mockPayment = {
    id: 'pay-1',
    sessionId: 'session-1',
    playerId: 'player-1',
    amount: 1000,
    status: PaymentStatus.PENDING,
    paidAt: null,
    markedBy: null,
    createdAt: new Date(),
  };

  const mockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    paymentsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({ ...mockQueryBuilder }),
    };
    sessionsRepo = {
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({ ...mockQueryBuilder }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: getRepositoryToken(Session), useValue: sessionsRepo },
        { provide: NotificationsService, useValue: { later: jest.fn(), notifyPlayers: jest.fn(), notifyOrganisers: jest.fn() } },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('markAsPaid', () => {
    it('should update status, set paidAt, and recalculate session', async () => {
      const payment = { ...mockPayment };
      const qb = { ...mockQueryBuilder, getOne: jest.fn().mockResolvedValue(payment) };
      paymentsRepo.createQueryBuilder.mockReturnValue(qb);
      paymentsRepo.save.mockResolvedValue({ ...payment, status: PaymentStatus.PAID });
      paymentsRepo.find.mockResolvedValue([{ amount: 1000, status: PaymentStatus.PAID }]);

      const result = await service.markAsPaid('pay-1', 'org-1', 'admin-1');

      expect(payment.status).toBe(PaymentStatus.PAID);
      expect(payment.paidAt).toBeDefined();
      expect(payment.markedBy).toBe('admin-1');
      expect(paymentsRepo.save).toHaveBeenCalled();
      expect(sessionsRepo.update).toHaveBeenCalledWith('session-1', { collectedAmount: 1000 });
    });

    it('should throw NotFoundException if payment not found', async () => {
      const qb = { ...mockQueryBuilder, getOne: jest.fn().mockResolvedValue(null) };
      paymentsRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.markAsPaid('bad-id', 'org-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('waive', () => {
    it('should set status to WAIVED and recalculate session', async () => {
      const payment = { ...mockPayment };
      const qb = { ...mockQueryBuilder, getOne: jest.fn().mockResolvedValue(payment) };
      paymentsRepo.createQueryBuilder.mockReturnValue(qb);
      paymentsRepo.save.mockResolvedValue({ ...payment, status: PaymentStatus.WAIVED });
      paymentsRepo.find.mockResolvedValue([]);

      await service.waive('pay-1', 'org-1', 'admin-1');

      expect(payment.status).toBe(PaymentStatus.WAIVED);
      expect(payment.markedBy).toBe('admin-1');
      expect(sessionsRepo.update).toHaveBeenCalledWith('session-1', { collectedAmount: 0 });
    });
  });

  describe('bulkMarkAsPaid', () => {
    it('should mark multiple payments and recalculate affected sessions', async () => {
      const payment1 = { ...mockPayment, id: 'pay-1', sessionId: 'session-1' };
      const payment2 = { ...mockPayment, id: 'pay-2', sessionId: 'session-2' };

      let callCount = 0;
      paymentsRepo.createQueryBuilder.mockImplementation(() => ({
        ...mockQueryBuilder,
        getOne: jest.fn().mockResolvedValue(callCount++ === 0 ? payment1 : payment2),
      }));
      paymentsRepo.save.mockResolvedValue([payment1, payment2]);
      paymentsRepo.find.mockResolvedValue([{ amount: 1000, status: PaymentStatus.PAID }]);

      await service.bulkMarkAsPaid(['pay-1', 'pay-2'], 'org-1', 'admin-1');

      expect(paymentsRepo.save).toHaveBeenCalled();
      // Should recalculate both sessions
      expect(sessionsRepo.update).toHaveBeenCalledTimes(2);
    });
  });
});
