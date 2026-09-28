import { IsObject } from 'class-validator';

export class SubmitVotesDto {
  /** category → nominee player id, e.g. { potm: "<uuid>", pace: "<uuid>" } */
  @IsObject()
  picks: Record<string, string>;
}
