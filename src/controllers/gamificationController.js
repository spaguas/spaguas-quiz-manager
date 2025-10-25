import * as gamificationService from '../services/gamificationService.js';

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
