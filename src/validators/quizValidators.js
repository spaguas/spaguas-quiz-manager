import { z } from 'zod';

const quizModeSchema = z.enum(['SEQUENTIAL', 'RANDOM']);

export const youtubeUrlSchema = z
  .string()
  .trim()
  .url('Informe uma URL válida')
  .refine((value) => /youtu\.be|youtube\.com/.test(value), 'Informe uma URL do YouTube válida');

const nonNegativeInt = z.number().int().min(0, 'Informe um valor maior ou igual a zero');

const questionLimitSchema = z
  .number()
  .int()
  .min(1, 'Informe uma quantidade de perguntas maior que zero')
  .nullable();

const optionSchema = z.object({
  text: z.string().min(1, 'Alternativa deve ter texto'),
  isCorrect: z.boolean(),
});

const backgroundIntensitySchema = z
  .number({ invalid_type_error: 'Informe um valor numérico.' })
  .min(0.1, 'Informe um valor mínimo de 0.1')
  .max(1, 'Informe um valor máximo de 1');

export const quizCreateSchema = z
  .object({
    title: z.string().min(3, 'Título deve ter ao menos 3 caracteres'),
    description: z.string().min(5, 'Descrição deve ter ao menos 5 caracteres'),
    isActive: z.boolean().optional().default(true),
    mode: quizModeSchema.default('SEQUENTIAL'),
    questionLimit: questionLimitSchema.optional(),
    backgroundVideoUrl: youtubeUrlSchema.optional(),
    backgroundVideoStart: nonNegativeInt.optional(),
    backgroundVideoEnd: nonNegativeInt.optional(),
    backgroundVideoLoop: z.boolean().optional().default(true),
    backgroundVideoMuted: z.boolean().optional().default(true),
    backgroundImageIntensity: backgroundIntensitySchema.optional().default(0.65),
    backgroundVideoIntensity: backgroundIntensitySchema.optional().default(0.65),
  })
  .superRefine((data, ctx) => {
    const hasVideo = Boolean(data.backgroundVideoUrl);
    if (!hasVideo) {
      if (data.backgroundVideoStart !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe uma URL de vídeo para definir o tempo inicial.',
          path: ['backgroundVideoStart'],
        });
      }
      if (data.backgroundVideoEnd !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe uma URL de vídeo para definir o tempo final.',
          path: ['backgroundVideoEnd'],
        });
      }
    }

    if (
      data.backgroundVideoEnd !== undefined &&
      data.backgroundVideoStart !== undefined &&
      data.backgroundVideoEnd <= data.backgroundVideoStart
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tempo final deve ser maior que o tempo inicial.',
        path: ['backgroundVideoEnd'],
      });
    }
  });

export const quizUpdateSchema = z
  .object({
    title: z.string().min(3, 'Título deve ter ao menos 3 caracteres').optional(),
    description: z.string().min(5, 'Descrição deve ter ao menos 5 caracteres').optional(),
    isActive: z.boolean().optional(),
    mode: quizModeSchema.optional(),
    questionLimit: questionLimitSchema.optional(),
    backgroundVideoUrl: youtubeUrlSchema.optional().nullable(),
    backgroundVideoStart: nonNegativeInt.optional().nullable(),
    backgroundVideoEnd: nonNegativeInt.optional().nullable(),
    backgroundVideoLoop: z.boolean().optional(),
    backgroundVideoMuted: z.boolean().optional(),
    backgroundImageIntensity: backgroundIntensitySchema.optional(),
    backgroundVideoIntensity: backgroundIntensitySchema.optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.isActive !== undefined ||
      data.mode !== undefined ||
      data.questionLimit !== undefined ||
      data.backgroundVideoUrl !== undefined ||
      data.backgroundVideoStart !== undefined ||
      data.backgroundVideoEnd !== undefined ||
      data.backgroundVideoLoop !== undefined ||
      data.backgroundVideoMuted !== undefined ||
      data.backgroundImageIntensity !== undefined ||
      data.backgroundVideoIntensity !== undefined,
    { message: 'Informe ao menos um campo para atualizar', path: ['_root'] },
  )
  .superRefine((data, ctx) => {
    const hasVideoUrl =
      data.backgroundVideoUrl !== undefined ? Boolean(data.backgroundVideoUrl) : undefined;

    if (data.backgroundVideoStart !== undefined && data.backgroundVideoStart !== null && hasVideoUrl === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe ou mantenha uma URL de vídeo para definir o tempo inicial.',
        path: ['backgroundVideoStart'],
      });
    }

    if (data.backgroundVideoEnd !== undefined && data.backgroundVideoEnd !== null && hasVideoUrl === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe ou mantenha uma URL de vídeo para definir o tempo final.',
        path: ['backgroundVideoEnd'],
      });
    }

    if (
      data.backgroundVideoEnd !== undefined &&
      data.backgroundVideoEnd !== null &&
      data.backgroundVideoStart !== undefined &&
      data.backgroundVideoStart !== null &&
      data.backgroundVideoEnd <= data.backgroundVideoStart
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tempo final deve ser maior que o tempo inicial.',
        path: ['backgroundVideoEnd'],
      });
    }
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

export const participationCheckSchema = z.object({
  quizId: z.number().int().positive(),
  userEmail: z.string().trim().email('Informe um e-mail válido'),
  userName: z.string().trim().optional(),
});
