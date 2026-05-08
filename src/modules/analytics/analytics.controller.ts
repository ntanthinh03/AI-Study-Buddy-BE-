import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('stats')
  async getStats(@Req() req: any) {
    return await this.analyticsService.getUserStats(req.user.userId);
  }

  @Get('chart')
  async getChart(@Req() req: any) {
    return await this.analyticsService.getWeeklyChartData(req.user.userId);
  }
}
