import * as gamificationService from '../services/gamificationService.js';
import { badgeCreateSchema, badgeUpdateSchema } from '../validators/gamificationValidators.js';

export async function getMyGamification(req, res, next) {
  try {
    const userId = Number(req.user.id);
    const data = await gamificationService.getUserGamification(userId);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

export async function getLeaderboard(req, res, next) {
  try {
    const limit = Number(req.query.limit) || 20;
    const data = await gamificationService.getGlobalLeaderboard(limit);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

export async function listBadges(req, res, next) {
  try {
    const data = await gamificationService.listBadges();
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

export async function createBadge(req, res, next) {
  try {
    const payload = badgeCreateSchema.parse(req.body);
    const data = await gamificationService.createBadge(payload);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

export async function updateBadge(req, res, next) {
  try {
    const payload = badgeUpdateSchema.parse(req.body);
    const data = await gamificationService.updateBadge(req.params.badgeId, payload);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

export async function deleteBadge(req, res, next) {
  try {
    await gamificationService.deleteBadge(req.params.badgeId);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
