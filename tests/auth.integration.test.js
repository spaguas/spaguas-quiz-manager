import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestServer } from './helpers/testServer.js';

let app;
let cleanup;

describe('Auth API integration', () => {
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

  it('registers, authenticates, updates profile and resets password', async () => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'initialPass123',
      })
      .expect(201);

    expect(registerResponse.body).toHaveProperty('token');
    expect(registerResponse.body.user.role).toBe('ADMIN');

    const authHeader = { Authorization: `Bearer ${registerResponse.body.token}` };

    const meResponse = await request(app)
      .get('/api/auth/me')
      .set(authHeader)
      .expect(200);

    expect(meResponse.body).toMatchObject({
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'ADMIN',
    });

    const profileUpdate = await request(app)
      .put('/api/auth/me')
      .set(authHeader)
      .send({
        name: 'Administrador Atualizado',
        email: 'admin@spaguas.test',
      })
      .expect(200);

    expect(profileUpdate.body).toMatchObject({
      name: 'Administrador Atualizado',
      email: 'admin@spaguas.test',
    });

    await request(app)
      .put('/api/auth/me/password')
      .set(authHeader)
      .send({
        currentPassword: 'initialPass123',
        newPassword: 'NovaSenha#456',
      })
      .expect(200);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@spaguas.test',
        password: 'NovaSenha#456',
      })
      .expect(200);

    expect(loginResponse.body).toHaveProperty('token');

    const forgotResponse = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'admin@spaguas.test' })
      .expect(200);

    expect(forgotResponse.body).toHaveProperty('message');
    expect(forgotResponse.body).toHaveProperty('token');
    const resetToken = forgotResponse.body.token;

    await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        password: 'SenhaFinal789',
      })
      .expect(200);

    const finalLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@spaguas.test',
        password: 'SenhaFinal789',
      })
      .expect(200);

    expect(finalLogin.body.user.email).toBe('admin@spaguas.test');
  });
});
