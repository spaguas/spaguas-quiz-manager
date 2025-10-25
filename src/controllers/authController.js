import * as authService from '../services/authService.js';
import { registerSchema, loginSchema } from '../validators/authValidators.js';

export async function register(req, res, next) {
  try {
    const payload = registerSchema.parse(req.body);
    const authResult = await authService.register(payload);
    return res.status(201).json(authResult);
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const payload = loginSchema.parse(req.body);
    const authResult = await authService.login(payload);
    return res.json(authResult);
  } catch (error) {
    return next(error);
  }
}
