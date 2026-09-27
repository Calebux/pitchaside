import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlayersService } from './players.service';
import { Player } from './entities/player.entity';
import { Payment } from '../payments/entities/payment.entity';

describe('PlayersService', () => {
  let service: PlayersService;
  let playersRepo: Record<string, jest.Mock>;
  let paymentsRepo: Record<string, jest.Mock>;

  const mockPlayer = {
    id: 'player-1',
    firstName: 'John',
    lastName: 'Doe',
    phone: '08012345678',
    email: 'john@test.com',
    organizationId: 'org-1',
    memberships: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    playersRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((entity) => Promise.resolve({ ...mockPlayer, ...entity })),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    };
    paymentsRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({ ...mockQueryBuilder }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayersService,
        { provide: getRepositoryToken(Player), useValue: playersRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
      ],
    }).compile();

    service = module.get<PlayersService>(PlayersService);
  });

  describe('create', () => {
    it('should create player with organization association', async () => {
      const dto = { firstName: 'John', lastName: 'Doe', phone: '08012345678' };
      playersRepo.create.mockReturnValue({ ...dto, organizationId: 'org-1' });
      playersRepo.save.mockResolvedValue({ ...mockPlayer });

      const result = await service.create(dto as any, 'org-1');

      expect(playersRepo.create).toHaveBeenCalledWith({
        ...dto,
        organizationId: 'org-1',
      });
      expect(result.organizationId).toBe('org-1');
      expect(result.firstName).toBe('John');
    });
  });

  describe('getStats', () => {
    it('should calculate correct totals and payment rate', async () => {
      playersRepo.findOne.mockResolvedValue(mockPlayer);

      const payments = [
        { id: 'p1', status: 'paid', amount: 1000 },
        { id: 'p2', status: 'paid', amount: 1000 },
        { id: 'p3', status: 'pending', amount: 1000 },
        { id: 'p4', status: 'paid', amount: 500 },
        { id: 'p5', status: 'pending', amount: 500 },
      ];

      const qb = {
        ...mockQueryBuilder,
        getMany: jest.fn().mockResolvedValue(payments),
      };
      paymentsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStats('player-1', 'org-1');

      expect(result.totalSessions).toBe(5);
      expect(result.totalPaid).toBe(2500); // 1000+1000+500
      expect(result.totalOwed).toBe(1500); // 1000+500
      expect(result.paymentRate).toBe(60); // 3/5 = 60%
    });

    it('should return zeros when player has no payments', async () => {
      playersRepo.findOne.mockResolvedValue(mockPlayer);

      const qb = {
        ...mockQueryBuilder,
        getMany: jest.fn().mockResolvedValue([]),
      };
      paymentsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStats('player-1', 'org-1');

      expect(result.totalSessions).toBe(0);
      expect(result.totalPaid).toBe(0);
      expect(result.totalOwed).toBe(0);
      expect(result.paymentRate).toBe(0);
    });
  });
});
