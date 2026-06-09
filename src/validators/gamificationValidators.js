import { z } from 'zod';
import {
  BADGE_CONDITION_METRICS,
  BADGE_CONDITION_OPERATORS,
} from '../services/gamificationService.js';

const badgeConditionMetricSchema = z.enum(BADGE_CONDITION_METRICS);
const badgeConditionOperatorSchema = z.enum(BADGE_CONDITION_OPERATORS);

const badgeBaseSchema = {
  code: z
    .string()
    .trim()
    .min(2, 'Informe um código para a conquista')
    .regex(/[A-Za-z0-9]/, 'O código deve conter letras ou números'),
  name: z.string().trim().min(2, 'Informe o nome da conquista'),
  description: z.string().trim().min(3, 'Informe a descrição da conquista'),
  icon: z.string().trim().min(1, 'Informe um ícone para a conquista'),
  conditionMetric: badgeConditionMetricSchema,
  conditionOperator: badgeConditionOperatorSchema,
  conditionValue: z
    .number({ invalid_type_error: 'Informe um valor numérico para a condição' })
    .min(0, 'O valor da condição não pode ser negativo'),
  isActive: z.boolean().default(true),
};

export const badgeCreateSchema = z.object(badgeBaseSchema);

export const badgeUpdateSchema = z
  .object({
    code: badgeBaseSchema.code.optional(),
    name: badgeBaseSchema.name.optional(),
    description: badgeBaseSchema.description.optional(),
    icon: badgeBaseSchema.icon.optional(),
    conditionMetric: badgeBaseSchema.conditionMetric.optional(),
    conditionOperator: badgeBaseSchema.conditionOperator.optional(),
    conditionValue: badgeBaseSchema.conditionValue.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
    path: ['_root'],
  });
