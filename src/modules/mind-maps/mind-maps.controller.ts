import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MindMapsService } from './mind-maps.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('mind-maps')
@UseGuards(JwtAuthGuard)
export class MindMapsController {
  constructor(private readonly mindMapsService: MindMapsService) {}

  @Post('generate')
  async generate(
    @Request() req,
    @Body() body: { documentId: string; text: string },
  ) {
    return this.mindMapsService.generateAndSave(
      req.user.userId,
      body.documentId,
      body.text,
    );
  }

  @Get()
  async findAll(@Request() req) {
    return this.mindMapsService.findAllByUser(req.user.userId);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.mindMapsService.findOne(id, req.user.userId);
  }
}
