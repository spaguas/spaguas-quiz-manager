import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import quizRouter from './routes/quizRoutes.js';
import authRouter from './routes/authRoutes.js';
import userRouter from './routes/userRoutes.js';
import gamificationRouter from './routes/gamificationRoutes.js';
import errorHandler from './middlewares/errorHandler.js';
import appConfig from './config/appConfig.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsPath = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use(`${appConfig.basePath}/uploads`, express.static(uploadsPath));

const apiBase = `${appConfig.basePath}/api`;

app.use(`${apiBase}/auth`, authRouter);
app.use(`${apiBase}/admin/users`, userRouter);
app.use(`${apiBase}/gamification`, gamificationRouter);
app.use(apiBase, quizRouter);

const clientDistPath = path.resolve(__dirname, '../client/dist');
const shouldServeClient = process.env.SERVE_CLIENT !== 'false' && fs.existsSync(clientDistPath);

if (shouldServeClient) {
  app.use(appConfig.basePath || '/', express.static(clientDistPath));

  const serveSpa = (req, res, next) => {
    const requestPath = appConfig.basePath ? req.path.replace(appConfig.basePath, '') || '/' : req.path;
    if (requestPath.startsWith('/api') || requestPath.startsWith('/uploads')) {
      return next();
    }
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  };

  if (appConfig.basePath) {
    app.get(appConfig.basePath, serveSpa);
  } else {
    app.get('/', serveSpa);
  }
  app.get(`${appConfig.basePath}/*`, serveSpa);
}

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada' });
});

app.use(errorHandler);

export default app;
