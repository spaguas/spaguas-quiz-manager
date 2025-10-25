import { adminCreateUserSchema } from '../validators/authValidators.js';
import * as userService from '../services/userService.js';

export async function createUser(req, res, next) {
  try {
    const payload = adminCreateUserSchema.parse(req.body);
    const user = await userService.createUser(payload);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
}

export async function listUsers(req, res, next) {
  try {
    const users = await userService.listUsers();
    return res.json(users);
  } catch (error) {
    return next(error);
  }
}
