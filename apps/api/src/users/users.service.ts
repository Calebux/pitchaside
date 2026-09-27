import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  create(data: Partial<User>) {
    const user = this.usersRepo.create(data);
    return this.usersRepo.save(user);
  }

  findByEmail(email: string) {
    return this.usersRepo.findOne({
      where: { email },
      relations: ['organization'],
    });
  }

  findById(id: string) {
    return this.usersRepo.findOne({
      where: { id },
      relations: ['organization'],
    });
  }

  findByOrganization(organizationId: string) {
    return this.usersRepo.find({ where: { organizationId } });
  }

  findAll() {
    return this.usersRepo.find({ relations: ['organization'] });
  }

  count() {
    return this.usersRepo.count();
  }

  countByOrganization(organizationId: string) {
    return this.usersRepo.count({ where: { organizationId } });
  }
}
