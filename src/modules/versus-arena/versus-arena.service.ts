import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { VersusMatch, MatchStatus } from './entities/versus-match.entity';
import { Document } from '../../documents/entities/document.entity';
import { AIService } from '../../common/services/ai.service';
import { UserStats } from '../../users/entities/user-stats.entity';

@Injectable()
export class VersusArenaService {
  private readonly logger = new Logger(VersusArenaService.name);

  constructor(
    @InjectRepository(VersusMatch)
    private readonly matchRepository: Repository<VersusMatch>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(UserStats)
    private readonly statsRepository: Repository<UserStats>,
    private readonly aiService: AIService,
  ) {}

  async startMatch(user: any, documentId: string, mode = 'BOT', difficulty = 'MEDIUM'): Promise<VersusMatch> {
    const userId = user?.userId ?? user?.id ?? user;


    let stats = await this.statsRepository.findOne({ where: { user: { id: userId } } });
    if (stats && stats.versusLockoutUntil) {
      const lockoutTime = new Date(stats.versusLockoutUntil).getTime();
      if (lockoutTime > Date.now()) {
        const remainingSec = Math.ceil((lockoutTime - Date.now()) / 1000);
        throw new ForbiddenException(`Neural Arena is locked due to forfeits. Locked for ${remainingSec} more seconds.`);
      } else {

        stats.versusLockoutUntil = null;
        stats.versusWarningsCount = 0;
        stats.versusLastWarningAt = null;
        await this.statsRepository.save(stats);
      }
    }

    // Auto-expire warnings older than 2 hours
    if (stats && stats.versusLastWarningAt && !stats.versusLockoutUntil) {
      const twoHoursMs = 2 * 60 * 60 * 1000;
      if (Date.now() - new Date(stats.versusLastWarningAt).getTime() > twoHoursMs) {
        stats.versusWarningsCount = 0;
        stats.versusLastWarningAt = null;
        await this.statsRepository.save(stats);
      }
    }

    const document = await this.documentRepository.findOne({
      where: { id: documentId, user: { id: userId } },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    this.logger.log(`Starting Versus Match for user ${userId} and document ${documentId} with mode ${mode} difficulty ${difficulty}`);


    let initialQuestions = await this.aiService.generateQuiz(document.contentText || '');
    if (initialQuestions.length === 0) {
      initialQuestions = await this.aiService.generateQuiz(document.contentText || '');
    }
    
    const finalInitial = initialQuestions.slice(0, 3);
    if (finalInitial.length === 0) {
      throw new Error('AI failed to generate initial questions. Please try a different document or try again.');
    }

    let opponentName = 'AI Bot';
    let opponentElo = 1200;

    if (mode === 'BOT') {
      if (difficulty === 'EASY') {
        const easyBots = ['StudySloth', 'SleepyScribbler', 'CasualCortex'];
        opponentName = easyBots[Math.floor(Math.random() * easyBots.length)];
        opponentElo = 950 + Math.floor(Math.random() * 200);
      } else if (difficulty === 'HARD') {
        const hardBots = ['MasterMind.ai', 'CortexCommander', 'NeuroEinstein'];
        opponentName = hardBots[Math.floor(Math.random() * hardBots.length)];
        opponentElo = 1650 + Math.floor(Math.random() * 400);
      } else {
        const medBots = ['BrainyBuddy', 'QuizQuirky', 'SynapseSizer'];
        opponentName = medBots[Math.floor(Math.random() * medBots.length)];
        opponentElo = 1250 + Math.floor(Math.random() * 250);
      }
    } else {
      const pvpNames = ['Thinh_Nguyen', 'Alex_Study', 'Elena_KLTN', 'StudyJordan_26', 'MindPal_Buddy', 'Sophia_Scholastic'];
      opponentName = pvpNames[Math.floor(Math.random() * pvpNames.length)];
      opponentElo = 1250 + Math.floor(Math.random() * 300);
    }

    const match = this.matchRepository.create({
      user: { id: userId },
      document: { id: documentId },
      status: MatchStatus.GENERATING_INITIAL,
      mode,
      difficulty,
      opponentName,
      opponentElo,
      playerScore: 0,
      botScore: 0,
      playerCorrectCount: 0,
      botCorrectCount: 0,
      questions: finalInitial,
      playerAnswers: {},
      botAnswers: {},
    });

    const savedMatch = await this.matchRepository.save(match);


    this.generateRemainingQuestionsAsync(savedMatch.id, document.contentText || '');

    return savedMatch;
  }

  private async generateRemainingQuestionsAsync(matchId: string, contentText: string): Promise<void> {
    setTimeout(async () => {
      try {
        const match = await this.matchRepository.findOne({ where: { id: matchId } });
        if (!match) return;

        this.logger.log(`Background generation started for match ${matchId}`);
        
        const existing = [...match.questions];
        const extraQuestions = await this.aiService.generateMoreQuizQuestions(contentText, existing);
        
        if (extraQuestions.length > 0) {
          match.questions = [...existing, ...extraQuestions];
        }
        
        match.status = MatchStatus.IN_PROGRESS;
        await this.matchRepository.save(match);
        this.logger.log(`Background generation completed for match ${matchId}. Total questions: ${match.questions.length}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(`Background question generation failed for match ${matchId}: ${msg}`);
        try {
          const match = await this.matchRepository.findOne({ where: { id: matchId } });
          if (match && match.status === MatchStatus.GENERATING_INITIAL) {
            match.status = MatchStatus.IN_PROGRESS;
            await this.matchRepository.save(match);
          }
        } catch {}
      }
    }, 100);
  }

  async submitAnswer(
    user: any,
    matchId: string,
    questionIndex: number,
    selectedAnswer: string,
    timeTakenSeconds: number,
  ): Promise<VersusMatch> {
    const userId = user?.userId ?? user?.id ?? user;
    const match = await this.matchRepository.findOne({
      where: { id: matchId, user: { id: userId } },
      relations: ['user', 'opponent'],
    });

    if (!match) {
      throw new NotFoundException('Versus match not found');
    }

    if (questionIndex >= match.questions.length) {
      throw new Error('Question index out of bounds');
    }

    const question = match.questions[questionIndex];
    const isCorrect = question.correctAnswer === selectedAnswer;


    let scoreEarned = 0;
    if (isCorrect) {
      const timeBonus = Math.max(0, Math.round((30 - timeTakenSeconds) * (500 / 30)));
      scoreEarned = 1000 + timeBonus;
      match.playerCorrectCount += 1;
    }
    match.playerScore += scoreEarned;
    

    const updatedPlayerAnswers = { ...match.playerAnswers };
    updatedPlayerAnswers[questionIndex] = {
      selectedAnswer,
      scoreEarned,
      timeTakenSeconds,
    };
    match.playerAnswers = updatedPlayerAnswers;


    if (match.mode !== 'PVP_LOBBY') {
      const options = ['A', 'B', 'C', 'D'];
      let accuracy = 0.75;
      let minDelay = 4.0;
      let maxDelay = 12.0;

      if (match.difficulty === 'EASY') {
        accuracy = 0.55;
        minDelay = 6.0;
        maxDelay = 15.0;
      } else if (match.difficulty === 'HARD') {
        accuracy = 0.92;
        minDelay = 3.0;
        maxDelay = 8.0;
      }

      const botCorrect = Math.random() < accuracy;
      let botSelected = question.correctAnswer;
      if (!botCorrect) {
        const wrongOptions = options.filter(o => o !== question.correctAnswer);
        botSelected = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
      }

      const botTimeTaken = minDelay + Math.random() * (maxDelay - minDelay);
      let botScoreEarned = 0;
      if (botCorrect) {
        const botTimeBonus = Math.max(0, Math.round((30 - botTimeTaken) * (500 / 30)));
        botScoreEarned = 1000 + botTimeBonus;
        match.botCorrectCount += 1;
      }
      match.botScore += botScoreEarned;

      const updatedBotAnswers = { ...match.botAnswers };
      updatedBotAnswers[questionIndex] = {
        selectedAnswer: botSelected,
        isCorrect: botCorrect,
      };
      match.botAnswers = updatedBotAnswers;
    }


    const totalQuestions = match.questions.length;
    const playerAnswered = Object.keys(match.playerAnswers).length;
    const opponentAnswered = Object.keys(match.botAnswers).length;

    if (match.mode === 'PVP_LOBBY') {
      if (playerAnswered >= totalQuestions && opponentAnswered >= totalQuestions && match.status === MatchStatus.IN_PROGRESS) {
        await this.completeMultiplayerMatch(match);
      }
    } else {
      if (playerAnswered >= totalQuestions && match.status === MatchStatus.IN_PROGRESS) {
        match.status = MatchStatus.COMPLETED;
        
        let winXP = 50;
        if (match.playerScore > match.botScore) {
          winXP = 100;
        } else if (match.playerScore === match.botScore) {
          winXP = 75;
        }
        
        let stats = await this.statsRepository.findOne({ where: { user: { id: userId } } });
        if (stats) {

          const eloA = stats.elo;
          const eloB = match.opponentElo;
          const EA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
          const SA = match.playerScore > match.botScore ? 1.0 : (match.playerScore === match.botScore ? 0.5 : 0.0);
          const change = Math.round(32 * (SA - EA));
          stats.elo = Math.max(800, stats.elo + change);

          if (SA === 1.0) {
            stats.versusWinStreak += 1;
          } else {
            stats.versusWinStreak = 0;
          }

          let multiplier = 1.0;
          if (stats.learningMode === 'CASUAL') multiplier = 0.8;
          else if (stats.learningMode === 'INTENSE') multiplier = 1.5;
          
          const finalXP = Math.round(winXP * multiplier);
          stats.totalXP += finalXP;
          stats.level = Math.floor(stats.totalXP / 1000) + 1;
          await this.statsRepository.save(stats);
        }
      }
    }

    return await this.matchRepository.save(match);
  }

  async getMatchStatus(user: any, matchId: string): Promise<VersusMatch> {
    const userId = user?.userId ?? user?.id ?? user;
    const match = await this.matchRepository.findOne({
      where: { id: matchId, user: { id: userId } },
    });
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    return match;
  }

  async quitMatch(user: any, matchId: string) {
    const userId = user?.userId ?? user?.id ?? user;
    const match = await this.matchRepository.findOne({
      where: { id: matchId, user: { id: userId } },
    });
    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (match.status === MatchStatus.COMPLETED || match.status === MatchStatus.ABORTED) {
      return { success: false, message: 'Match already finished.' };
    }

    match.status = MatchStatus.ABORTED;
    await this.matchRepository.save(match);

    let stats = await this.statsRepository.findOne({ where: { user: { id: userId } } });
    if (!stats) {
      stats = this.statsRepository.create({ user: { id: userId } });
    }

    // Auto-expire warnings older than 2 hours before incrementing
    if (stats.versusLastWarningAt && !stats.versusLockoutUntil) {
      const twoHoursMs = 2 * 60 * 60 * 1000;
      if (Date.now() - new Date(stats.versusLastWarningAt).getTime() > twoHoursMs) {
        stats.versusWarningsCount = 0;
        stats.versusLastWarningAt = null;
      }
    }

    stats.versusWarningsCount += 1;
    stats.versusLastWarningAt = new Date();
    let locked = false;
    let lockoutUntil: Date | null = null;

    if (stats.versusWarningsCount >= 3) {
      lockoutUntil = new Date(Date.now() + 6 * 60 * 60 * 1000);
      stats.versusLockoutUntil = lockoutUntil;
      stats.versusWarningsCount = 0;
      stats.versusLastWarningAt = null;
      locked = true;
    }

    await this.statsRepository.save(stats);

    return {
      success: true,
      warningsCount: stats.versusWarningsCount,
      locked,
      lockoutUntil,
    };
  }

  async getLockoutStatus(user: any) {
    const userId = user?.userId ?? user?.id ?? user;
    let stats = await this.statsRepository.findOne({ where: { user: { id: userId } } });
    if (!stats) {
      return { locked: false, remainingSeconds: 0, warningsCount: 0 };
    }

    if (stats.versusLockoutUntil) {
      const lockoutTime = new Date(stats.versusLockoutUntil).getTime();
      if (lockoutTime > Date.now()) {
        const remainingSeconds = Math.ceil((lockoutTime - Date.now()) / 1000);
        return {
          locked: true,
          remainingSeconds,
          warningsCount: stats.versusWarningsCount,
        };
      } else {

        stats.versusLockoutUntil = null;
        stats.versusWarningsCount = 0;
        stats.versusLastWarningAt = null;
        await this.statsRepository.save(stats);
      }
    }

    // Auto-expire warnings older than 2 hours
    if (stats.versusLastWarningAt) {
      const twoHoursMs = 2 * 60 * 60 * 1000;
      if (Date.now() - new Date(stats.versusLastWarningAt).getTime() > twoHoursMs) {
        stats.versusWarningsCount = 0;
        stats.versusLastWarningAt = null;
        await this.statsRepository.save(stats);
      }
    }

    return {
      locked: false,
      remainingSeconds: 0,
      warningsCount: stats.versusWarningsCount,
    };
  }

  async createRoom(user: any) {
    const userId = user?.userId ?? user?.id ?? user;
    

    let stats = await this.statsRepository.findOne({ where: { user: { id: userId } } });
    if (stats && stats.versusLockoutUntil) {
      const lockoutTime = new Date(stats.versusLockoutUntil).getTime();
      if (lockoutTime > Date.now()) {
        const remainingSec = Math.ceil((lockoutTime - Date.now()) / 1000);
        throw new ForbiddenException(`Neural Arena is locked. Locked for ${remainingSec} seconds.`);
      }
    }


    const roomCode = Math.floor(100000 + Math.random() * 900000).toString();

    const hostStats = await this.statsRepository.findOne({ where: { user: { id: userId } }, relations: ['user'] });

    const match = this.matchRepository.create({
      user: { id: userId },
      status: MatchStatus.LOBBY,
      mode: 'PVP_LOBBY',
      roomCode,
      opponentName: 'Waiting...',
      opponentElo: 1200,
      playerScore: 0,
      botScore: 0,
      playerCorrectCount: 0,
      botCorrectCount: 0,
      questions: [],
      playerAnswers: {},
      botAnswers: {},
    });

    const saved = await this.matchRepository.save(match);
    return {
      id: saved.id,
      status: saved.status,
      roomCode: saved.roomCode,
      hostName: hostStats ? (hostStats.user.fullName || hostStats.user.email.split('@')[0]) : 'Host',
      hostElo: hostStats ? hostStats.elo : 1200,
    };
  }

  async joinRoom(user: any, roomCode: string) {
    const userId = user?.userId ?? user?.id ?? user;


    let guestStats = await this.statsRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (guestStats && guestStats.versusLockoutUntil) {
      const lockoutTime = new Date(guestStats.versusLockoutUntil).getTime();
      if (lockoutTime > Date.now()) {
        const remainingSec = Math.ceil((lockoutTime - Date.now()) / 1000);
        throw new ForbiddenException(`Neural Arena is locked. Locked for ${remainingSec} seconds.`);
      }
    }

    const match = await this.matchRepository.findOne({
      where: { roomCode, status: MatchStatus.LOBBY },
      relations: ['user', 'opponent'],
    });

    if (!match) {
      throw new NotFoundException('Active room code not found');
    }

    if (match.user.id === userId) {
      throw new BadRequestException('Cannot join your own private room');
    }


    match.opponent = { id: userId } as any;
    match.opponentName = guestStats ? (guestStats.user.fullName || guestStats.user.email.split('@')[0]) : 'Guest';
    match.opponentElo = guestStats ? guestStats.elo : 1200;
    match.status = MatchStatus.PVP_LOBBY;
    await this.matchRepository.save(match);

    const hostStats = await this.statsRepository.findOne({ where: { user: { id: match.user.id } } });

    return {
      id: match.id,
      status: match.status,
      roomCode: match.roomCode,
      hostName: match.user.fullName || match.user.email.split('@')[0],
      hostElo: hostStats ? hostStats.elo : 1200,
      opponentName: match.opponentName,
      opponentElo: match.opponentElo,
    };
  }

  async startRoomMatch(user: any, matchId: string, documentId: string) {
    const userId = user?.userId ?? user?.id ?? user;
    const match = await this.matchRepository.findOne({
      where: { id: matchId, user: { id: userId } },
      relations: ['user', 'opponent'],
    });

    if (!match) {
      throw new NotFoundException('Match room not found or you are not the host');
    }

    const document = await this.documentRepository.findOne({
      where: { id: documentId, user: { id: userId } },
    });
    if (!document) {
      throw new NotFoundException('Document PDF not found');
    }


    let initialQuestions = await this.aiService.generateQuiz(document.contentText || '');
    if (initialQuestions.length === 0) {
      initialQuestions = await this.aiService.generateQuiz(document.contentText || '');
    }

    const finalInitial = initialQuestions.slice(0, 3);
    if (finalInitial.length === 0) {
      throw new Error('AI failed to generate initial questions. Try again.');
    }

    match.document = { id: documentId } as any;
    match.questions = finalInitial;
    match.status = MatchStatus.GENERATING_INITIAL;
    await this.matchRepository.save(match);


    this.generateRemainingQuestionsAsync(match.id, document.contentText || '');

    const hostStats = await this.statsRepository.findOne({ where: { user: { id: userId } } });

    return {
      id: match.id,
      status: match.status,
      roomCode: match.roomCode,
      hostName: match.user.fullName || match.user.email.split('@')[0],
      hostElo: hostStats ? hostStats.elo : 1200,
      opponentName: match.opponentName,
      opponentElo: match.opponentElo,
    };
  }

  async getLobbyStatus(user: any, matchId: string) {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
      relations: ['user', 'opponent'],
    });
    if (!match) {
      throw new NotFoundException('Match not found');
    }

    const hostStats = await this.statsRepository.findOne({ where: { user: { id: match.user.id } } });
    const guestStats = match.opponent ? await this.statsRepository.findOne({ where: { user: { id: match.opponent.id } } }) : null;

    return {
      id: match.id,
      status: match.status,
      mode: match.mode,
      roomCode: match.roomCode,
      hostName: match.user.fullName || match.user.email.split('@')[0],
      hostElo: hostStats ? hostStats.elo : 1200,
      opponentName: match.opponentName,
      opponentElo: match.opponentElo,
      playerScore: match.playerScore,
      botScore: match.botScore,
      playerCorrectCount: match.playerCorrectCount,
      botCorrectCount: match.botCorrectCount,
      questions: match.questions,
      playerAnswers: match.playerAnswers,
      botAnswers: match.botAnswers,
    };
  }

  async submitOpponentAnswer(
    user: any,
    matchId: string,
    questionIndex: number,
    selectedAnswer: string,
    timeTakenSeconds: number,
  ): Promise<VersusMatch> {
    const userId = user?.userId ?? user?.id ?? user;
    const match = await this.matchRepository.findOne({
      where: { id: matchId, opponent: { id: userId } },
      relations: ['user', 'opponent'],
    });

    if (!match) {
      throw new NotFoundException('Versus match not found for this guest');
    }

    if (questionIndex >= match.questions.length) {
      throw new Error('Question index out of bounds');
    }

    const question = match.questions[questionIndex];
    const isCorrect = question.correctAnswer === selectedAnswer;


    let scoreEarned = 0;
    if (isCorrect) {
      const timeBonus = Math.max(0, Math.round((30 - timeTakenSeconds) * (500 / 30)));
      scoreEarned = 1000 + timeBonus;
      match.botCorrectCount += 1;
    }
    match.botScore += scoreEarned;

    const updatedBotAnswers = { ...match.botAnswers };
    updatedBotAnswers[questionIndex] = {
      selectedAnswer,
      isCorrect,
    } as any;
    match.botAnswers = updatedBotAnswers;


    const totalQuestions = match.questions.length;
    const playerAnswered = Object.keys(match.playerAnswers).length;
    const opponentAnswered = Object.keys(match.botAnswers).length;

    if (playerAnswered >= totalQuestions && opponentAnswered >= totalQuestions && match.status === MatchStatus.IN_PROGRESS) {
      await this.completeMultiplayerMatch(match);
    }

    return await this.matchRepository.save(match);
  }

  private async completeMultiplayerMatch(match: VersusMatch) {
    match.status = MatchStatus.COMPLETED;

    const hostId = match.user.id;
    const guestId = match.opponent ? match.opponent.id : null;

    let hostStats = await this.statsRepository.findOne({ where: { user: { id: hostId } } });
    let guestStats = guestId ? await this.statsRepository.findOne({ where: { user: { id: guestId } } }) : null;

    if (hostStats && guestStats) {
      const eloA = hostStats.elo;
      const eloB = guestStats.elo;


      const EA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
      const EB = 1 / (1 + Math.pow(10, (eloA - eloB) / 400));

      let SA = 0.5;
      let SB = 0.5;

      if (match.playerScore > match.botScore) {
        SA = 1.0;
        SB = 0.0;
        hostStats.versusWinStreak += 1;
        guestStats.versusWinStreak = 0;
      } else if (match.playerScore < match.botScore) {
        SA = 0.0;
        SB = 1.0;
        guestStats.versusWinStreak += 1;
        hostStats.versusWinStreak = 0;
      } else {
        hostStats.versusWinStreak = 0;
        guestStats.versusWinStreak = 0;
      }


      const changeA = Math.round(32 * (SA - EA));
      const changeB = Math.round(32 * (SB - EB));

      hostStats.elo = Math.max(800, hostStats.elo + changeA);
      guestStats.elo = Math.max(800, guestStats.elo + changeB);


      let hostXP = SA === 1.0 ? 100 : (SA === 0.5 ? 75 : 50);
      let guestXP = SB === 1.0 ? 100 : (SB === 0.5 ? 75 : 50);

      const hostMultiplier = hostStats.learningMode === 'CASUAL' ? 0.8 : (hostStats.learningMode === 'INTENSE' ? 1.5 : 1.0);
      const guestMultiplier = guestStats.learningMode === 'CASUAL' ? 0.8 : (guestStats.learningMode === 'INTENSE' ? 1.5 : 1.0);

      hostStats.totalXP += Math.round(hostXP * hostMultiplier);
      hostStats.level = Math.floor(hostStats.totalXP / 1000) + 1;

      guestStats.totalXP += Math.round(guestXP * guestMultiplier);
      guestStats.level = Math.floor(guestStats.totalXP / 1000) + 1;

      await this.statsRepository.save(hostStats);
      await this.statsRepository.save(guestStats);
    }
  }

  async getMatchHistory(user: any) {
    const userId = user?.userId ?? user?.id ?? user;
    
    const matches = await this.matchRepository.find({
      where: [
        { user: { id: userId } },
        { opponent: { id: userId } }
      ],
      relations: ['user', 'opponent'],
      order: { createdAt: 'DESC' },
      take: 15,
    });

    return Promise.all(matches.map(async (m) => {
      const isHost = m.user.id === userId;
      let oppName = m.opponentName;
      let oppElo = m.opponentElo;

      if (m.mode === 'PVP_LOBBY') {
        if (isHost) {
          oppName = m.opponentName;
        } else {
          oppName = m.user.fullName || m.user.email.split('@')[0];
          const hostStats = await this.statsRepository.findOne({ where: { user: { id: m.user.id } } });
          oppElo = hostStats ? hostStats.elo : 1200;
        }
      }

      let resultText = 'DRAW';
      let scoreText = `${m.playerScore} - ${m.botScore}`;

      if (isHost) {
        if (m.status === MatchStatus.ABORTED) {
          resultText = 'DEFEAT (Forfeit)';
        } else if (m.playerScore > m.botScore) {
          resultText = 'VICTORY';
        } else if (m.playerScore < m.botScore) {
          resultText = 'DEFEAT';
        }
      } else {
        if (m.status === MatchStatus.ABORTED) {
          resultText = 'DEFEAT (Forfeit)';
        } else if (m.botScore > m.playerScore) {
          resultText = 'VICTORY';
        } else if (m.botScore < m.playerScore) {
          resultText = 'DEFEAT';
        }
        scoreText = `${m.botScore} - ${m.playerScore}`;
      }

      const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      };
      const dateText = new Date(m.createdAt).toLocaleDateString('en-US', options);

      return {
        matchId: m.id,
        opponentName: oppName,
        opponentElo: oppElo,
        resultText,
        scoreText,
        dateText,
        mode: m.mode,
      };
    }));
  }

  async updateArenaName(user: any, newName: string) {
    const userId = user?.userId ?? user?.id ?? user;
    if (!newName || newName.trim().length < 3) {
      throw new BadRequestException('Arena name must be at least 3 characters long');
    }

    let stats = await this.statsRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!stats) {
      stats = this.statsRepository.create({ user: { id: userId } });
      await this.statsRepository.save(stats);
      stats = await this.statsRepository.findOne({
        where: { user: { id: userId } },
        relations: ['user'],
      });
    }


    if (stats.lastArenaNameChange) {
      const elapsed = Date.now() - new Date(stats.lastArenaNameChange).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (elapsed < sevenDaysMs) {
        const remainingDays = Math.ceil((sevenDaysMs - elapsed) / (24 * 60 * 60 * 1000));
        throw new BadRequestException(`Arena name cooldown active. You can change it again in ${remainingDays} days.`);
      }
    }


    const normalized = newName.trim();
    const existing = await this.statsRepository.findOne({
      where: { arenaName: ILike(normalized) }
    });
    if (existing && existing.id !== stats.id) {
      throw new BadRequestException('This Arena name is already taken by another duelist.');
    }

    stats.arenaName = normalized;
    stats.lastArenaNameChange = new Date();
    return await this.statsRepository.save(stats);
  }

  async updateAvatar(user: any, avatarData: string) {
    const userId = user?.userId ?? user?.id ?? user;
    let stats = await this.statsRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!stats) {
      stats = this.statsRepository.create({ user: { id: userId } });
      await this.statsRepository.save(stats);
      stats = await this.statsRepository.findOne({
        where: { user: { id: userId } },
        relations: ['user'],
      });
    }

    stats.user.avatar = avatarData;
    await this.statsRepository.manager.save(stats.user);
    return stats;
  }
}
