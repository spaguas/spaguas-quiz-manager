import { ZodError } from 'zod';
import multer from 'multer';
import { maxUploadSizeLabel } from '../config/uploadConfig.js';

export default function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Dados inválidos',
      issues: err.issues,
    });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: `Imagem excede o limite de ${maxUploadSizeLabel}.` });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: 'Envie arquivos PNG válidos para background/header.' });
    }
    return res.status(400).json({ message: 'Falha ao processar upload de imagem.' });
  }

  if (err?.status) {
    return res.status(err.status).json({ message: err.message });
  }

  console.error(err);
  return res.status(500).json({ message: 'Erro interno do servidor' });
}
