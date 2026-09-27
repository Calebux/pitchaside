import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { OrganizationsService } from './organizations/organizations.service';
import { UserRole } from './users/entities/user.entity';
import * as bcrypt from 'bcrypt';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const orgsService = app.get(OrganizationsService);

  // Create super-admin org + user if not exists
  const existingAdmin = await usersService.findByEmail('admin@pitchaside.com');
  if (existingAdmin) {
    console.log('Super admin already exists, skipping seed.');
    await app.close();
    return;
  }

  const org = await orgsService.create('PitchAside HQ');
  console.log(`Created organization: ${org.name} (${org.id})`);

  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await usersService.create({
    firstName: 'Super',
    lastName: 'Admin',
    email: 'admin@pitchaside.com',
    passwordHash,
    role: UserRole.SUPER_ADMIN,
    organizationId: org.id,
  });
  console.log(`Created super admin: ${admin.email} (password: admin123)`);

  await app.close();
  console.log('Seed completed.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
