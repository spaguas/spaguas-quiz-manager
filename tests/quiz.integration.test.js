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

    const questionRes = await request(app)
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
});
