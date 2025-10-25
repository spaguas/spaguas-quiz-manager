import 'dotenv/config';
import app from './app.js';
import prisma from './config/prisma.js';

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`Servidor iniciado na porta ${port}`);
});

const shutdown = async () => {
  server.close(() => {
    console.log('Servidor encerrado');
  });

  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
