import { IsString, MaxLength } from 'class-validator';

/** A photo from the phone as a data URL; checked properly by parsePhoto. */
export class PhotoDto {
  @IsString()
  @MaxLength(100_000)
  image: string;
}
