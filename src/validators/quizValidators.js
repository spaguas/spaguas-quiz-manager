import { z } from 'zod';

const quizModeSchema = z.enum(['SEQUENTIAL', 'RANDOM']);

const questionLimitSchema = z.number().int().min(1, 'Informe uma quantidade de perguntas maior que zero').nullable();

export const quizCreateSchema = z.object({
  title: z.string().min(3, 'Título deve ter ao menos 3 caracteres'),
  description: z.string().min(5, 'Descrição deve ter ao menos 5 caracteres'),
  isActive: z.boolean().optional().default(true),
  mode: quizModeSchema.default('SEQUENTIAL'),
  questionLimit: questionLimitSchema.optional(),
});

export const quizUpdateSchema = z.object({
  title: z.string().min(3, 'Título deve ter ao menos 3 caracteres').optional(),
  description: z.string().min(5, 'Descrição deve ter ao menos 5 caracteres').optional(),
  isActive: z.boolean().optional(),
  mode: quizModeSchema.optional(),
  questionLimit: questionLimitSchema.optional(),
}).refine(
  (data) =>
    data.title !== undefined ||
    data.description !== undefined ||
    data.isActive !== undefined ||
    data.mode !== undefined ||
    data.questionLimit !== undefined,
  { message: 'Informe ao menos um campo para atualizar', path: ['_root'] },
);

const optionSchema = z.object({
  text: z.string().min(1, 'Alternativa deve ter texto'),
  isCorrect: z.boolean(),
});

export const questionCreateSchema = z.object({
  quizId: z.number().int().positive(),
  text: z.string().min(3, 'Pergunta deve ter ao menos 3 caracteres'),
  order: z.number().int().min(1, 'Ordem deve ser igual ou maior que 1'),
  options: z.array(optionSchema).min(2, 'Informe pelo menos 2 alternativas'),
}).refine((data) => data.options.some((option) => option.isCorrect), {
  message: 'Pelo menos uma alternativa deve ser correta',
  path: ['options'],
});

export const submissionSchema = z.object({
  quizId: z.number().int().positive(),
  userName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  userEmail: z.string().trim().email('Informe um e-mail válido'),
  answers: z.array(
    z.object({
      questionId: z.number().int().positive(),
      optionId: z.number().int().positive(),
    }),
  ).min(1, 'Informe ao menos uma resposta'),
});

export const answerValidationSchema = z.object({
  quizId: z.number().int().positive(),
  questionId: z.number().int().positive(),
  optionId: z.number().int().positive(),
});
