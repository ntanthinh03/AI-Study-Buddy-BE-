import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true, namespace: '/study-rooms' })
export class StudyRoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private rooms: Map<string, Set<string>> = new Map();
  
  private quizStates: Map<string, {
    hostId: string;
    hostUsername: string;
    questions: any[];
    currentQuestionIndex: number;
    scores: Map<string, number>;
    playerNames: Map<string, string>;
    answeredPlayers: Set<string>;
    selectedDocumentName?: string;
    isGeneratingMore: boolean;
    isWaitingForMore: boolean;
  }> = new Map();

  handleConnection(client: Socket) {
    console.log(`Client connected to study rooms: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.leaveAllRooms(client);
    this.cleanupEmptyRooms();
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: { roomCode: string; username: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`[StudyRoomsGateway] joinRoom triggered. Client: ${client.id}, roomCode: ${data?.roomCode}, username: ${data?.username}`);
    const roomCode = data.roomCode.trim().toUpperCase();
    if (!roomCode) {
      console.log(`[StudyRoomsGateway] Rejected empty roomCode`);
      return { event: 'error', data: 'Invalid room code' };
    }

    client.join(roomCode);
    if (!this.rooms.has(roomCode)) {
      this.rooms.set(roomCode, new Set());
    }
    this.rooms.get(roomCode)?.add(client.id);

    if (!this.quizStates.has(roomCode)) {
      this.quizStates.set(roomCode, {
        hostId: client.id,
        hostUsername: data.username,
        questions: [],
        currentQuestionIndex: -1,
        scores: new Map(),
        playerNames: new Map(),
        answeredPlayers: new Set(),
        isGeneratingMore: false,
        isWaitingForMore: false
      });
    }
    const state = this.quizStates.get(roomCode)!;
    state.playerNames.set(client.id, data.username);
    if (!state.scores.has(client.id)) {
      state.scores.set(client.id, 0);
    }

    client.to(roomCode).emit('userJoined', { username: data.username, socketId: client.id });
    
    const participants = Array.from(this.rooms.get(roomCode) || []).map(
      sid => state.playerNames.get(sid) || 'Unknown'
    );
    
    const rankings = this.getRankings(roomCode);
    client.emit('leaderboardUpdate', rankings);

    return { event: 'joined', data: { roomCode, isHost: state.hostUsername === data.username, participants, selectedDocumentName: state.selectedDocumentName } };
  }

  private getRankings(roomCode: string) {
    const state = this.quizStates.get(roomCode);
    if (!state) return [];
    return Array.from(state.scores.entries()).map(([sid, score]) => ({
      username: state.playerNames.get(sid) || 'Unknown',
      score
    })).sort((a, b) => b.score - a.score);
  }

  private cleanupEmptyRooms() {
    for (const [roomCode, clients] of this.rooms.entries()) {
      if (clients.size === 0) {
        this.rooms.delete(roomCode);
        this.quizStates.delete(roomCode);
        console.log(`Cleaned up empty room: ${roomCode}`);
      }
    }
  }

  @SubscribeMessage('requestMaterialSelection')
  handleRequestMaterialSelection(
    @MessageBody() data: { roomCode: string },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.quizStates.get(data.roomCode);
    const username = state?.playerNames.get(client.id);
    if (state && state.hostUsername === username) {
      this.server.to(data.roomCode).emit('materialSelectionStarted', { hostId: client.id });
    }
  }

  @SubscribeMessage('materialSelected')
  handleMaterialSelected(
    @MessageBody() data: { roomCode: string; documentId: string; fileName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.quizStates.get(data.roomCode);
    if (state) {
      state.selectedDocumentName = data.fileName;
    }
    this.server.to(data.roomCode).emit('hostSelectedMaterial', { fileName: data.fileName });
  }

  @SubscribeMessage('quizPreparing')
  handleQuizPreparing(
    @MessageBody() data: { roomCode: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.roomCode).emit('quizPreparing');
  }

  @SubscribeMessage('startQuiz')
  handleStartQuiz(
    @MessageBody() data: { roomCode: string; questions: any[] },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.quizStates.get(data.roomCode);
    const username = state?.playerNames.get(client.id);
    if (state && state.hostUsername === username) {
      state.questions = data.questions;
      state.currentQuestionIndex = 0;
      state.scores.clear();
      state.answeredPlayers.clear();
      state.isGeneratingMore = true;
      state.isWaitingForMore = false;
      this.rooms.get(data.roomCode)?.forEach(sid => state.scores.set(sid, 0));

      const endsAt = Date.now() + 30000;
      this.server.to(data.roomCode).emit('quizStarted', { 
        roomCode: data.roomCode,
        totalQuestions: data.questions.length,
        questions: data.questions,
        endsAt
      });
    }
  }

  @SubscribeMessage('addQuestions')
  handleAddQuestions(
    @MessageBody() data: { roomCode: string; additionalQuestions: any[] },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.quizStates.get(data.roomCode);
    if (state) {
      state.questions = [...state.questions, ...data.additionalQuestions];
      console.log(`[addQuestions] roomCode=${data.roomCode}, total questions now: ${state.questions.length}`);
      this.server.to(data.roomCode).emit('questionsUpdated', { 
        totalQuestions: state.questions.length 
      });


      if (state.isWaitingForMore && state.currentQuestionIndex < state.questions.length - 1) {
        state.isWaitingForMore = false;
        state.currentQuestionIndex++;
        state.answeredPlayers.clear();
        const endsAt = Date.now() + 30000;
        this.server.to(data.roomCode).emit('newQuestion', {
          index: state.currentQuestionIndex,
          question: state.questions[state.currentQuestionIndex],
          endsAt
        });
        const rankings = this.getRankings(data.roomCode);
        this.server.to(data.roomCode).emit('leaderboardUpdate', rankings);
      }
    }
  }

  @SubscribeMessage('submitAnswer')
  handleSubmitAnswer(
    @MessageBody() data: { roomCode: string; answer: string; timeRemainingRatio: number },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.quizStates.get(data.roomCode);
    if (!state) return;
    if (state.answeredPlayers.has(client.id)) return;
    state.answeredPlayers.add(client.id);

    const currentQuestion = state.questions[state.currentQuestionIndex];
    const isCorrect = data.answer === currentQuestion.correctAnswer;

    if (isCorrect) {
      const basePoints = 100;
      const bonus = Math.floor(100 * data.timeRemainingRatio);
      const totalPoints = basePoints + bonus;
      
      const currentScore = state.scores.get(client.id) || 0;
      state.scores.set(client.id, currentScore + totalPoints);
    }

    const totalInRoom = this.rooms.get(data.roomCode)?.size || 1;
    this.server.to(data.roomCode).emit('answerProgress', {
      answeredCount: state.answeredPlayers.size,
      totalCount: totalInRoom
    });

    const rankings = this.getRankings(data.roomCode);
    this.server.to(data.roomCode).emit('leaderboardUpdate', rankings);
  }

  @SubscribeMessage('nextQuestion')
  handleNextQuestion(
    @MessageBody() data: { roomCode: string; username?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.quizStates.get(data.roomCode);
    const username = data.username || state?.playerNames.get(client.id);
    console.log(`[handleNextQuestion] roomCode: ${data.roomCode}, username: ${username}, hostUsername: ${state?.hostUsername}`);
    if (state && state.hostUsername === username) {
      if (state.currentQuestionIndex < state.questions.length - 1) {

        state.currentQuestionIndex++;
        state.answeredPlayers.clear();
        const endsAt = Date.now() + 30000;
        this.server.to(data.roomCode).emit('newQuestion', {
          index: state.currentQuestionIndex,
          question: state.questions[state.currentQuestionIndex],
          endsAt
        });
      } else if (state.isGeneratingMore) {

        console.log(`[handleNextQuestion] Waiting for more questions in room ${data.roomCode}...`);
        state.isWaitingForMore = true;
        this.server.to(data.roomCode).emit('waitingForQuestions');
      } else {

        this.server.to(data.roomCode).emit('quizEnded', {
          finalRankings: this.getRankings(data.roomCode)
        });
      }
    }
  }

  @SubscribeMessage('generationComplete')
  handleGenerationComplete(
    @MessageBody() data: { roomCode: string },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.quizStates.get(data.roomCode);
    if (state) {
      console.log(`[generationComplete] roomCode=${data.roomCode}, total questions: ${state.questions.length}`);
      state.isGeneratingMore = false;

      if (state.isWaitingForMore) {
        state.isWaitingForMore = false;
        this.server.to(data.roomCode).emit('quizEnded', {
          finalRankings: this.getRankings(data.roomCode)
        });
      }
    }
  }

  @SubscribeMessage('startFocus')
  handleStartFocus(
    @MessageBody() data: { roomCode: string; durationMinutes: number },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.roomCode).emit('focusStarted', { durationMinutes: data.durationMinutes, startedBy: client.id });
  }

  @SubscribeMessage('failFocus')
  handleFailFocus(
    @MessageBody() data: { roomCode: string; username: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.roomCode).emit('focusFailed', { username: data.username });
  }

  private leaveAllRooms(client: Socket) {
    for (const [roomCode, clients] of this.rooms.entries()) {
      if (clients.has(client.id)) {
        const state = this.quizStates.get(roomCode);
        const username = state?.playerNames.get(client.id) || 'Unknown';
        clients.delete(client.id);
        state?.playerNames.delete(client.id);
        state?.scores.delete(client.id);
        
        const participants = Array.from(clients).map(
          sid => state?.playerNames.get(sid) || 'Unknown'
        );
        client.to(roomCode).emit('userLeft', { username, socketId: client.id, participants });
      }
    }
  }
}
