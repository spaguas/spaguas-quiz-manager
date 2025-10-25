import jwt from 'jsonwebtoken';
import HttpError from '../utils/httpError.js';

function extractToken(authorizationHeader) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

export function authenticate(req, res, next) {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    return next(new HttpError(401, 'Credenciais não fornecidas'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.sub,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
    };
    return next();
  } catch (error) {
    return next(new HttpError(401, 'Token inválido ou expirado'));
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new HttpError(403, 'Acesso restrito a administradores'));
  }

  return next();
}
