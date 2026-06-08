import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestServer } from './helpers/testServer.js';

let app;
let cleanup;

describe('Quiz API integration', () => {
  beforeEach(async () => {
    const context = await createTestServer();
    app = context.app;
    cleanup = context.cleanup;
  });

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  it('allows admin to manage quiz and players to participate', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'Secret123',
      })
      .expect(201);

    const adminToken = registerRes.body.token;
    const authHeader = { Authorization: `Bearer ${adminToken}` };

    const createQuizRes = await request(app)
      .post('/api/admin/quizzes')
      .set(authHeader)
      .send({
        title: 'Conhecimentos Gerais',
        description: 'Quiz sobre temas gerais para participantes.',
        isActive: true,
      })
      .expect(201);

    const quizId = createQuizRes.body.id;
    expect(quizId).toBeDefined();

    const firstQuestionRes = await request(app)
      .post(`/api/admin/quizzes/${quizId}/questions`)
      .set(authHeader)
      .send({
        text: 'Qual é a capital do Brasil?',
        order: 1,
        options: [
          { text: 'Rio de Janeiro', isCorrect: false },
          { text: 'Brasília', isCorrect: true },
          { text: 'São Paulo', isCorrect: false },
        ],
      })
      .expect(201);

    const questionId = questionRes.body.id;
    const correctOption = questionRes.body.options.find((option) => option.isCorrect === true);
    expect(correctOption).toBeDefined();

    const listRes = await request(app)
      .get('/api/quizzes')
      .expect(200);

    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0]).toMatchObject({
      id: quizId,
      title: 'Conhecimentos Gerais',
      questionCount: 1,
    });

    const playRes = await request(app)
      .get(`/api/quizzes/${quizId}`)
      .expect(200);

    expect(playRes.body.questions[0].id).toBe(questionId);

    const submissionRes = await request(app)
      .post(`/api/quizzes/${quizId}/submissions`)
      .send({
        userName: 'Participante 1',
        userEmail: 'participante1@example.com',
        answers: [
          {
            questionId,
            optionId: correctOption.id,
          },
        ],
      })
      .expect(201);

    expect(submissionRes.body.score).toBe(1);
    expect(submissionRes.body.position).toBe(1);

    await request(app)
      .post(`/api/quizzes/${quizId}/submissions`)
      .send({
        userName: 'Participante 2',
        userEmail: 'participante1@example.com',
        answers: [
          {
            questionId,
            optionId: correctOption.id,
          },
        ],
      })
      .expect(409);

    const rankingRes = await request(app)
      .get(`/api/quizzes/${quizId}/ranking`)
      .expect(200);

    expect(rankingRes.body.ranking).toHaveLength(1);
    expect(rankingRes.body.ranking[0].userName).toBe('Participante 1');

    await request(app)
      .delete(`/api/admin/quizzes/${quizId}/ranking`)
      .set(authHeader)
      .expect(200);

    const rankingAfterClear = await request(app)
      .get(`/api/quizzes/${quizId}/ranking`)
      .expect(200);

    expect(rankingAfterClear.body.ranking).toHaveLength(0);
  });

  it('allows creating a quiz without background video when video fields are null', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin-no-video@example.com',
        password: 'Secret123',
      })
      .expect(201);

    const authHeader = { Authorization: `Bearer ${registerRes.body.token}` };

    const createQuizRes = await request(app)
      .post('/api/admin/quizzes')
      .set(authHeader)
      .send({
        title: 'Quiz sem vídeo',
        description: 'Quiz criado sem vídeo de fundo.',
        isActive: true,
        mode: 'SEQUENTIAL',
        questionLimit: null,
        backgroundVideoUrl: null,
        backgroundVideoStart: null,
        backgroundVideoEnd: null,
        backgroundVideoLoop: true,
        backgroundVideoMuted: true,
        backgroundImageIntensity: 0.65,
        backgroundVideoIntensity: 0.65,
      })
      .expect(201);

    expect(createQuizRes.body).toMatchObject({
      title: 'Quiz sem vídeo',
      backgroundVideoUrl: null,
      backgroundVideoStart: null,
      backgroundVideoEnd: null,
    });
  });

  it('limits questions when quiz is random with a maximum defined', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin-random@example.com',
        password: 'Secret123',
      })
      .expect(201);

    const adminToken = registerRes.body.token;
    const authHeader = { Authorization: `Bearer ${adminToken}` };

    const createQuizRes = await request(app)
      .post('/api/admin/quizzes')
      .set(authHeader)
      .send({
        title: 'Quiz Aleatório',
        description: 'Quiz com limite de perguntas.',
        isActive: true,
        mode: 'RANDOM',
        questionLimit: 2,
      })
      .expect(201);

    const quizId = createQuizRes.body.id;
    const questionRegistry = new Map();

    const questions = [
      {
        text: 'Pergunta 1',
        options: [
          { text: 'Opção A', isCorrect: true },
          { text: 'Opção B', isCorrect: false },
        ],
      },
      {
        text: 'Pergunta 2',
        options: [
          { text: 'Opção C', isCorrect: true },
          { text: 'Opção D', isCorrect: false },
        ],
      },
      {
        text: 'Pergunta 3',
        options: [
          { text: 'Opção E', isCorrect: true },
          { text: 'Opção F', isCorrect: false },
        ],
      },
    ];

    for (let index = 0; index < questions.length; index += 1) {
      const questionPayload = questions[index];
      const questionRes = await request(app)
        .post(`/api/admin/quizzes/${quizId}/questions`)
        .set(authHeader)
        .send({
          text: questionPayload.text,
          order: index + 1,
          options: questionPayload.options,
        })
        .expect(201);

      const correctOption = questionRes.body.options.find((option) => option.isCorrect === true);
      questionRegistry.set(questionRes.body.id, correctOption.id);
    }

    const playRes = await request(app)
      .get(`/api/quizzes/${quizId}`)
      .expect(200);

    expect(playRes.body.questions).toHaveLength(2);

    const answers = playRes.body.questions.map((question) => {
      const correctOptionId = questionRegistry.get(question.id);
      expect(correctOptionId).toBeDefined();
      return {
        questionId: question.id,
        optionId: correctOptionId,
      };
    });

    const submissionRes = await request(app)
      .post(`/api/quizzes/${quizId}/submissions`)
      .send({
        userName: 'Participante Random',
        userEmail: 'random-participant@example.com',
        answers,
      })
      .expect(201);

    expect(submissionRes.body.total).toBe(2);

    await request(app)
      .post(`/api/quizzes/${quizId}/submissions`)
      .send({
        userName: 'Participante Incompleto',
        userEmail: 'random-participant-2@example.com',
        answers: answers.slice(0, 1),
      })
      .expect(400);
  });

  it('includes temporary participants in the global ranking and breaks score ties by duration', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin-ranking@example.com',
        password: 'Secret123',
      })
      .expect(201);

    const authHeader = { Authorization: `Bearer ${registerRes.body.token}` };

    const createQuizRes = await request(app)
      .post('/api/admin/quizzes')
      .set(authHeader)
      .send({
        title: 'Ranking por duração',
        description: 'Quiz para validar desempate por tempo.',
        isActive: true,
      })
      .expect(201);

    const quizId = createQuizRes.body.id;

    const questionRes = await request(app)
      .post(`/api/admin/quizzes/${quizId}/questions`)
      .set(authHeader)
      .send({
        text: 'Qual alternativa está correta?',
        order: 1,
        options: [
          { text: 'Correta', isCorrect: true },
          { text: 'Incorreta', isCorrect: false },
        ],
      })
      .expect(201);

    const secondQuestionRes = await request(app)
      .post(`/api/admin/quizzes/${quizId}/questions`)
      .set(authHeader)
      .send({
        text: 'Qual é a segunda alternativa correta?',
        order: 2,
        options: [
          { text: 'Correta 2', isCorrect: true },
          { text: 'Incorreta 2', isCorrect: false },
        ],
      })
      .expect(201);

    const firstCorrectOption = firstQuestionRes.body.options.find((option) => option.isCorrect === true);
    const secondCorrectOption = secondQuestionRes.body.options.find((option) => option.isCorrect === true);
    const secondIncorrectOption = secondQuestionRes.body.options.find((option) => option.isCorrect === false);
    const correctAnswers = [
      {
        questionId: firstQuestionRes.body.id,
        optionId: firstCorrectOption.id,
      },
      {
        questionId: secondQuestionRes.body.id,
        optionId: secondCorrectOption.id,
      },
    ];
    const lowerScoreAnswers = [
      {
        questionId: firstQuestionRes.body.id,
        optionId: firstCorrectOption.id,
      },
      {
        questionId: secondQuestionRes.body.id,
        optionId: secondIncorrectOption.id,
      },
    ];

    const slowSubmission = await request(app)
      .post(`/api/quizzes/${quizId}/submissions`)
      .send({
        userName: 'Temporário Lento',
        userEmail: 'temporario-lento@example.com',
        durationSeconds: 30,
        answers: correctAnswers,
      })
      .expect(201);

    expect(slowSubmission.body.position).toBe(1);

    const fastSubmission = await request(app)
      .post(`/api/quizzes/${quizId}/submissions`)
      .send({
        userName: 'Temporário Rápido',
        userEmail: 'temporario-rapido@example.com',
        durationSeconds: 10,
        answers: correctAnswers,
      })
      .expect(201);

    expect(fastSubmission.body.position).toBe(1);

    await request(app)
      .post(`/api/quizzes/${quizId}/submissions`)
      .send({
        userName: 'Menos Acertos Rápido',
        userEmail: 'menos-acertos-rapido@example.com',
        durationSeconds: 1,
        answers: lowerScoreAnswers,
      })
      .expect(201);

    const quizRankingRes = await request(app)
      .get(`/api/quizzes/${quizId}/ranking`)
      .query({ limit: 10 })
      .expect(200);

    expect(quizRankingRes.body.ranking[0]).toMatchObject({
      userName: 'Temporário Rápido',
      score: 2,
      durationSeconds: 10,
      position: 1,
    });
    expect(quizRankingRes.body.ranking[1]).toMatchObject({
      userName: 'Temporário Lento',
      score: 2,
      durationSeconds: 30,
      position: 2,
    });
    expect(quizRankingRes.body.ranking[2]).toMatchObject({
      userName: 'Menos Acertos Rápido',
      score: 1,
      durationSeconds: 1,
      position: 3,
    });

    const globalRankingRes = await request(app)
      .get('/api/gamification/leaderboard')
      .expect(200);

    expect(globalRankingRes.body[0]).toMatchObject({
      name: 'Temporário Rápido',
      email: 'temporario-rapido@example.com',
      totalCorrect: 2,
      totalDurationSeconds: 10,
      position: 1,
    });
    expect(globalRankingRes.body[1]).toMatchObject({
      name: 'Temporário Lento',
      email: 'temporario-lento@example.com',
      totalCorrect: 2,
      totalDurationSeconds: 30,
      position: 2,
    });
  });

  it('allows admin to configure ranking prizes and exposes stock availability in the public ranking', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin-prizes@example.com',
        password: 'Secret123',
      })
      .expect(201);

    const authHeader = { Authorization: `Bearer ${registerRes.body.token}` };

    const createQuizRes = await request(app)
      .post('/api/admin/quizzes')
      .set(authHeader)
      .send({
        title: 'Quiz com Prêmios',
        description: 'Quiz para validar brindes por posição.',
        isActive: true,
      })
      .expect(201);

    const quizId = createQuizRes.body.id;

    const questionRes = await request(app)
      .post(`/api/admin/quizzes/${quizId}/questions`)
      .set(authHeader)
      .send({
        text: 'Qual alternativa está correta?',
        order: 1,
        options: [
          { text: 'Correta', isCorrect: true },
          { text: 'Incorreta', isCorrect: false },
        ],
      })
      .expect(201);

    const correctOption = questionRes.body.options.find((option) => option.isCorrect === true);
    const answers = [
      {
        questionId: questionRes.body.id,
        optionId: correctOption.id,
      },
    ];

    const prizesRes = await request(app)
      .patch(`/api/admin/quizzes/${quizId}/prizes`)
      .set(authHeader)
      .send({
        prizes: [
          {
            position: 1,
            name: 'Garrafa térmica',
            description: 'Brinde do primeiro lugar',
            quantity: 3,
            availableQuantity: 2,
          },
          {
            position: 2,
            name: 'Copo personalizado',
            quantity: 1,
            availableQuantity: 0,
          },
        ],
      })
      .expect(200);

    const firstSubmissionRes = await request(app)
      .post(`/api/quizzes/${quizId}/submissions`)
      .send({
        userName: 'Participante Premiado',
        userEmail: 'premiado@example.com',
        durationSeconds: 10,
        answers,
      })
      .expect(201);

    expect(firstSubmissionRes.body.prizes[0]).toMatchObject({
      name: 'Garrafa térmica',
      availableQuantity: 2,
      isAvailable: true,
    });

    const claimRes = await request(app)
      .post(`/api/quizzes/${quizId}/submissions/${firstSubmissionRes.body.submissionId}/prizes/${prizesRes.body.prizes[0].id}/claim`)
      .send({
        userEmail: 'premiado@example.com',
        received: true,
      })
      .expect(200);

    expect(claimRes.body.prize).toMatchObject({
      name: 'Garrafa térmica',
      availableQuantity: 1,
      claimStatus: 'CLAIMED',
    });
    expect(claimRes.body.prize.claimedAt).toBeTruthy();

    const secondSubmissionRes = await request(app)
      .post(`/api/quizzes/${quizId}/submissions`)
      .send({
        userName: 'Segundo Lugar',
        userEmail: 'segundo-lugar@example.com',
        durationSeconds: 20,
        answers,
      })
      .expect(201);

    expect(secondSubmissionRes.body).toMatchObject({
      position: 2,
      hasUnavailablePrize: true,
    });
    expect(secondSubmissionRes.body.prizes[0]).toMatchObject({
      name: 'Copo personalizado',
      availableQuantity: 0,
      isAvailable: false,
    });

    expect(prizesRes.body.prizes).toHaveLength(2);
    expect(prizesRes.body.prizes[0]).toMatchObject({
      position: 1,
      name: 'Garrafa térmica',
      quantity: 3,
      availableQuantity: 2,
      isAvailable: true,
    });
    expect(prizesRes.body.prizes[1]).toMatchObject({
      position: 2,
      name: 'Copo personalizado',
      quantity: 1,
      availableQuantity: 0,
      isAvailable: false,
    });

    const rankingRes = await request(app)
      .get(`/api/quizzes/${quizId}/ranking`)
      .expect(200);

    expect(rankingRes.body.quiz.prizes).toHaveLength(2);
    expect(rankingRes.body.ranking[0].prizes[0]).toMatchObject({
      name: 'Garrafa térmica',
      claimStatus: 'CLAIMED',
    });
    expect(rankingRes.body.ranking[0].prizes[0].claimedAt).toBeTruthy();
    expect(rankingRes.body.quiz.prizes[0]).toMatchObject({
      position: 1,
      name: 'Garrafa térmica',
      availableQuantity: 1,
      isAvailable: true,
    });
  });
});
