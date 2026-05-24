import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { VersusArenaService } from './versus-arena.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('versus-arena')
@UseGuards(JwtAuthGuard)
export class VersusArenaController {
  constructor(private readonly versusArenaService: VersusArenaService) {}

  @Post('start')
  startMatch(@Request() req: any, @Body() body: { documentId: string; mode?: string; difficulty?: string }) {
    return this.versusArenaService.startMatch(req.user, body.documentId, body.mode, body.difficulty);
  }

  @Get('lockout-status')
  getLockoutStatus(@Request() req: any) {
    return this.versusArenaService.getLockoutStatus(req.user);
  }

  @Post(':matchId/quit')
  quitMatch(@Param('matchId') matchId: string, @Request() req: any) {
    return this.versusArenaService.quitMatch(req.user, matchId);
  }

  @Post(':matchId/submit')
  submitAnswer(
    @Param('matchId') matchId: string,
    @Body() body: { questionIndex: number; selectedAnswer: string; timeTakenSeconds: number },
    @Request() req: any,
  ) {
    return this.versusArenaService.submitAnswer(
      req.user,
      matchId,
      body.questionIndex,
      body.selectedAnswer,
      body.timeTakenSeconds,
    );
  }

  @Get('history')
  getMatchHistory(@Request() req: any) {
    return this.versusArenaService.getMatchHistory(req.user);
  }

  @Post('room/create')
  createRoom(@Request() req: any) {
    return this.versusArenaService.createRoom(req.user);
  }

  @Post('room/join')
  joinRoom(@Request() req: any, @Body() body: { roomCode: string }) {
    return this.versusArenaService.joinRoom(req.user, body.roomCode);
  }

  @Post('room/:matchId/start')
  startRoomMatch(
    @Param('matchId') matchId: string,
    @Body() body: { documentId: string },
    @Request() req: any,
  ) {
    return this.versusArenaService.startRoomMatch(req.user, matchId, body.documentId);
  }

  @Get('room/:matchId/lobby')
  getLobbyStatus(@Param('matchId') matchId: string, @Request() req: any) {
    return this.versusArenaService.getLobbyStatus(req.user, matchId);
  }

  @Post(':matchId/submit-opponent')
  submitOpponentAnswer(
    @Param('matchId') matchId: string,
    @Body() body: { questionIndex: number; selectedAnswer: string; timeTakenSeconds: number },
    @Request() req: any,
  ) {
    return this.versusArenaService.submitOpponentAnswer(
      req.user,
      matchId,
      body.questionIndex,
      body.selectedAnswer,
      body.timeTakenSeconds,
    );
  }

  @Post('profile/update-name')
  updateArenaName(@Request() req: any, @Body() body: { arenaName: string }) {
    return this.versusArenaService.updateArenaName(req.user, body.arenaName);
  }

  @Post('profile/update-avatar')
  updateAvatar(@Request() req: any, @Body() body: { avatar: string }) {
    return this.versusArenaService.updateAvatar(req.user, body.avatar);
  }

  @Get(':matchId/status')
  getMatchStatus(@Param('matchId') matchId: string, @Request() req: any) {
    return this.versusArenaService.getMatchStatus(req.user, matchId);
  }
}

