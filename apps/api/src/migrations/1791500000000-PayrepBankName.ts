import { MigrationInterface, QueryRunner } from 'typeorm';

/** The bank behind group accounts is now called Payrep Microfinance Bank (formerly Pulse). */
export class PayrepBankName1791500000000 implements MigrationInterface {
  name = 'PayrepBankName1791500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "groups" SET "bank_name" = 'Payrep Microfinance Bank' WHERE "bank_name" = 'Pulse Microfinance Bank'`);
    await q.query(
      `UPDATE "outgoing_transfers" SET "beneficiary_bank_name" = 'Payrep Microfinance Bank' WHERE "beneficiary_bank_name" = 'Pulse Microfinance Bank'`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "groups" SET "bank_name" = 'Pulse Microfinance Bank' WHERE "bank_name" = 'Payrep Microfinance Bank'`);
    await q.query(
      `UPDATE "outgoing_transfers" SET "beneficiary_bank_name" = 'Pulse Microfinance Bank' WHERE "beneficiary_bank_name" = 'Payrep Microfinance Bank'`,
    );
  }
}
