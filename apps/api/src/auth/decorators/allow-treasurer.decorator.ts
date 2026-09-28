import { SetMetadata } from '@nestjs/common';

export const ALLOW_TREASURER_KEY = 'allowTreasurer';

/**
 * Treasurers are read-only except for routes marked with this: recording
 * payments, matching transfers, reminders and their own account settings.
 */
export const AllowTreasurer = () => SetMetadata(ALLOW_TREASURER_KEY, true);
