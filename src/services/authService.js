import jwt from 'jsonwebtoken';
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
