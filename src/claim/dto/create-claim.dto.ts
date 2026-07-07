// src/claim/dto/create-claim.dto.ts

import { Type } from "class-transformer";
import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";

export class CreateClaimDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  policyId?: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 5000)
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;
}
