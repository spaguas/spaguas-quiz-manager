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

export const profileUpdateSchema = z.object({
  name: z.string().min(3, 'Informe um nome com ao menos 3 caracteres').optional(),
  email: z.string().email('Informe um e-mail válido').optional(),
}).refine((data) => data.name !== undefined || data.email !== undefined, {
  message: 'Informe ao menos um campo para atualizar',
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6, 'Senha atual inválida'),
  newPassword: z.string().min(6, 'Nova senha deve ter ao menos 6 caracteres'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Token inválido'),
  password: z.string().min(6, 'Nova senha deve ter ao menos 6 caracteres'),
});
