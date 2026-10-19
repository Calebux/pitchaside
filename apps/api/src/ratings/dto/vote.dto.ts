import { IsObject } from 'class-validator';

export class SubmitVotesDto {
  /** category → nominee player id, e.g. { potm: "<uuid>", teammate: "<uuid>" }; Best VII starters (`vii`) are a list of six. */
  @IsObject()
  picks: Record<string, string | string[]>;
}
