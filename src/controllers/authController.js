import * as authService from '../services/authService.js';
import {
  registerSchema,
  loginSchema,
  profileUpdateSchema,
  passwordChangeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/authValidators.js';

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

export async function getProfile(req, res, next) {
  try {
    const profile = await authService.getProfile(Number(req.user.id));
    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const payload = profileUpdateSchema.parse(req.body);
    const profile = await authService.updateProfile(Number(req.user.id), payload);
    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    const payload = passwordChangeSchema.parse(req.body);
    const result = await authService.changePassword(Number(req.user.id), payload);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const payload = forgotPasswordSchema.parse(req.body);
    const result = await authService.requestPasswordReset(payload.email);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const payload = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(payload);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
