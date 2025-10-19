import multer from 'multer';
import path from 'path';
import fs from 'fs'; // 🔹 Faltaba importar fs
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carpetas de uploads
const avatarsDir = path.join(__dirname, '../uploads/avatars');
const postsDir = path.join(__dirname, '../uploads/posts');
const storiesDir = path.join(__dirname, '../uploads/stories');

// Crear carpetas si no existen
[avatarsDir, postsDir, storiesDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configuración para avatares
export const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarsDir),
    filename: (req, file, cb) =>
      cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'), false);
  }
});

// Configuración para posts
export const postUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, postsDir),
    filename: (req, file, cb) =>
      cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/'))
      cb(null, true);
    else cb(new Error('Solo se permiten imágenes y videos'), false);
  }
});

// Configuración para stories
export const storyUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, storiesDir),
    filename: (req, file, cb) =>
      cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/'))
      cb(null, true);
    else cb(new Error('Solo se permiten imágenes o videos'), false);
  }
});

// Exportar todo
export default { avatarUpload, postUpload, storyUpload };
