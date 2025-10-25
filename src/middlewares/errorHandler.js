import { ZodError } from 'zod';

export default function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Dados inválidos',
      issues: err.issues,
    });
  }

  if (err?.status) {
    return res.status(err.status).json({ message: err.message });
  }

  console.error(err);
  return res.status(500).json({ message: 'Erro interno do servidor' });
}
