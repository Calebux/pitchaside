import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SessionsService } from './sessions.service';
import { Session, SessionStatus } from './entities/session.entity';
import { Group } from '../groups/entities/group.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { MailService } from '../mail/mail.service';
import { RsvpService } from '../rsvp/rsvp.service';
import { RatingsService } from '../ratings/ratings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecurrenceType } from './dto/create-session.dto';

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionsRepo: Record<string, jest.Mock>;
  let groupsRepo: Record<string, jest.Mock>;
  let membershipsRepo: Record<string, jest.Mock>;
  let paymentsRepo: Record<string, jest.Mock>;
  let mailService: Record<string, jest.Mock>;

  const mockGroup = {
    id: 'group-1',
    name: 'Monday Football',
    organizationId: 'org-1',
    targetPlayers: 10,
    feePerPlayer: 500,
  };

  const mockMemberships = [
    { id: 'mem-1', groupId: 'group-1', playerId: 'player-1' },
    { id: 'mem-2', groupId: 'group-1', playerId: 'player-2' },
  ];

  const mockSession = {
    id: 'session-1',
    groupId: 'group-1',
    date: '2026-01-15',
    targetAmount: 5000,
    collectedAmount: 0,
    status: SessionStatus.UPCOMING,
    group: mockGroup,
    payments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  };

  const notificationsService = {
    later: jest.fn(),
    notifyPlayers: jest.fn().mockResolvedValue({ delivered: 3, missed: 0 }),
  };

  beforeEach(async () => {
    sessionsRepo = {
      create: jest.fn((data) => ({ ...data, id: 'session-new' })),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: entity.id || 'session-new' })),
      createQueryBuilder: jest.fn().mockReturnValue({ ...mockQueryBuilder }),
    };
    groupsRepo = { findOne: jest.fn() };
    membershipsRepo = { find: jest.fn() };
    paymentsRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((entities) => Promise.resolve(entities)),
    };
    mailService = {
      sendPaymentReminder: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getRepositoryToken(Session), useValue: sessionsRepo },
        { provide: getRepositoryToken(Group), useValue: groupsRepo },
        { provide: getRepositoryToken(GroupMembership), useValue: membershipsRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: MailService, useValue: mailService },
        { provide: RsvpService, useValue: { announceGame: jest.fn() } },
        { provide: RatingsService, useValue: { ensureVotingToken: jest.fn() } },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  describe('create', () => {
    it('should create a session with payments for each group member', async () => {
      groupsRepo.findOne.mockResolvedValue(mockGroup);
      membershipsRepo.find.mockResolvedValue(mockMemberships);
      // findOne is called at the end — mock the query builder
      const qb = {
        ...mockQueryBuilder,
        getOne: jest.fn().mockResolvedValue(mockSession),
      };
      sessionsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.create(
        { groupId: 'group-1', date: '2026-01-15' },
        'org-1',
      );

      expect(sessionsRepo.create).toHaveBeenCalled();
      expect(sessionsRepo.save).toHaveBeenCalled();
      // Should create one payment per member
      expect(paymentsRepo.create).toHaveBeenCalledTimes(2);
      expect(paymentsRepo.save).toHaveBeenCalled();
    });

    it('should generate correct number of sessions for recurring', async () => {
      groupsRepo.findOne.mockResolvedValue(mockGroup);
      membershipsRepo.find.mockResolvedValue([]);
      const qb = {
        ...mockQueryBuilder,
        getOne: jest.fn().mockResolvedValue(mockSession),
      };
      sessionsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.create(
        {
          groupId: 'group-1',
          date: '2026-01-15',
          recurrenceType: RecurrenceType.WEEKLY,
          recurrenceCount: 4,
        },
        'org-1',
      );

      // Should create 4 sessions (one per week)
      expect(sessionsRepo.create).toHaveBeenCalledTimes(4);
      expect(sessionsRepo.save).toHaveBeenCalledTimes(4);
    });
  });

  describe('sendReminders', () => {
    it('should push a reminder to every unpaid player', async () => {
      const sessionWithPayments = {
        ...mockSession,
        payments: [
          {
            id: 'p1',
            status: PaymentStatus.PENDING,
            player: { firstName: 'John', email: 'john@test.com' },
            amount: 500,
          },
          {
            id: 'p2',
            status: PaymentStatus.PAID,
            player: { firstName: 'Jane', email: 'jane@test.com' },
            amount: 500,
          },
          {
            id: 'p3',
            status: PaymentStatus.PENDING,
            player: { firstName: 'Bob', email: null },
            amount: 500,
          },
          {
            id: 'p4',
            status: PaymentStatus.PENDING,
            player: { firstName: 'Alice', email: 'alice@test.com' },
            amount: 500,
          },
        ],
      };

      const qb = {
        ...mockQueryBuilder,
        getOne: jest.fn().mockResolvedValue(sessionWithPayments),
      };
      sessionsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.sendReminders('session-1', 'org-1');

      // John, Bob and Alice are pending (email no longer matters — reminders are push); Jane is paid
      expect(notificationsService.notifyPlayers).toHaveBeenCalledTimes(1);
      expect(notificationsService.notifyPlayers.mock.calls[0][0]).toHaveLength(3);
      expect(result.sent).toBe(3);
    });
  });
});
