import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import prisma from '../config/prisma.js';
import HttpError from '../utils/httpError.js';
import { comparePassword, hashPassword } from '../utils/password.js';

function buildTokenPayload(user) {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function buildAuthResponse(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET não configurado');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '2d';
  const token = jwt.sign(buildTokenPayload(user), secret, {
    expiresIn,
    subject: String(user.id),
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function register({ name, email, password }) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new HttpError(409, 'E-mail já cadastrado');
  }

  const passwordHash = await hashPassword(password);
  const totalUsers = await prisma.user.count();
  const role = totalUsers === 0 ? 'ADMIN' : 'USER';

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
    },
  });

  return buildAuthResponse(user);
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new HttpError(401, 'Credenciais inválidas');
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, 'Credenciais inválidas');
  }

  return buildAuthResponse(user);
}

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new HttpError(404, 'Usuário não encontrado');
  }

  return user;
}

export async function updateProfile(userId, { name, email }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new HttpError(404, 'Usuário não encontrado');
  }

  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new HttpError(409, 'E-mail já utilizado por outro usuário');
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updated;
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new HttpError(404, 'Usuário não encontrado');
  }

  const matches = await comparePassword(currentPassword, user.passwordHash);
  if (!matches) {
    throw new HttpError(401, 'Senha atual incorreta');
  }

  if (currentPassword === newPassword) {
    throw new HttpError(400, 'A nova senha deve ser diferente da atual');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await prisma.passwordResetToken.updateMany({
    where: {
      userId,
      used: false,
    },
    data: { used: true },
  });

  return { message: 'Senha atualizada com sucesso' };
}

function buildResetExpiryDate() {
  const minutes = Number(process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES ?? 60);
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  return now;
}

export async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return {
      message: 'Se o e-mail existir será enviado um link para redefinição',
    };
  }

  const token = crypto.randomBytes(32).toString('hex');

  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: buildResetExpiryDate(),
    },
  });

  return {
    message: 'Token de redefinição gerado com sucesso',
    token,
  };
}

export async function resetPassword({ token, password }) {
  const tokenEntry = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!tokenEntry || tokenEntry.used) {
    throw new HttpError(400, 'Token inválido ou já utilizado');
  }

  if (tokenEntry.expiresAt < new Date()) {
    throw new HttpError(400, 'Token expirado');
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenEntry.userId },
  });

  if (!user) {
    throw new HttpError(404, 'Usuário não encontrado');
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: tokenEntry.id },
      data: { used: true },
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
        id: { not: tokenEntry.id },
      },
      data: { used: true },
    }),
  ]);

  return { message: 'Senha redefinida com sucesso' };
}
