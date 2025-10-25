import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(3, 'Informe um nome com pelo menos 3 caracteres'),
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export const adminCreateUserSchema = registerSchema.extend({
  role: z.enum(['ADMIN', 'USER']).default('USER'),
});
