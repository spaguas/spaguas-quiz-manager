import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

const uploadsRoot = path.resolve(process.cwd(), 'uploads');
const quizUploadsRoot = path.join(uploadsRoot, 'quizzes');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const quizId = req.params.quizId;
    if (!quizId) {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }

    const destination = path.join(quizUploadsRoot, quizId);
    fs.mkdirSync(destination, { recursive: true });
    cb(null, destination);
  },
  filename(req, file, cb) {
    const label = file.fieldname === 'backgroundImage' ? 'background' : 'header';
    const timestamp = Date.now();
    cb(null, `${label}-${timestamp}.png`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== 'image/png') {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    return;
  }
  cb(null, true);
};

const uploadQuizImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export default uploadQuizImages;
