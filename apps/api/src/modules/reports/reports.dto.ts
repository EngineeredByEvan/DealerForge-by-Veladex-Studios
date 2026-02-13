import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export const REPORT_DIMENSIONS = ['source', 'assignedUser', 'status'] as const;
export const REPORT_METRICS = ['leads', 'appointments', 'sold'] as const;
export const TREND_INTERVALS = ['day'] as const;

export type ReportDimension = (typeof REPORT_DIMENSIONS)[number];
export type ReportMetric = (typeof REPORT_METRICS)[number];
export type TrendInterval = (typeof TREND_INTERVALS)[number];

class BaseReportQueryDto {
  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  source?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  assignedUser?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  status?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  leadType?: string;
}

export class QuerySummaryDto extends BaseReportQueryDto {}

export class QueryBreakdownDto extends BaseReportQueryDto {
  @IsIn(REPORT_DIMENSIONS)
  dimension!: ReportDimension;
}

export class QueryTrendsDto extends BaseReportQueryDto {
  @IsIn(REPORT_METRICS)
  metric!: ReportMetric;

  @IsOptional()
  @IsIn(TREND_INTERVALS)
  interval: TrendInterval = 'day';
}

export class QueryEventLogsDto {
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  eventType?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  entityType?: string;
}
