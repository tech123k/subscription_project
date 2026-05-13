const multer = require('multer');
const path = require('path');
const fs = require('fs');

const hasCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

let cloudinary = null;
let CloudinaryStorage = null;

if (hasCloudinary) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  CloudinaryStorage = require('multer-storage-cloudinary').CloudinaryStorage;
}

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!hasCloudinary && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const createStorage = (folder, allowedFormats) => {
  if (hasCloudinary) {
    return new CloudinaryStorage({
      cloudinary,
      params: {
        folder: `erp/${folder}`,
        allowed_formats: allowedFormats,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
    });
  }
  return diskStorage;
};

// multer uses req.file.path — for disk storage this is the absolute path;
// we expose a relative URL so the frontend can serve it
const processUploadedFile = (req, res, next) => {
  if (req.file && !hasCloudinary) {
    const filename = path.basename(req.file.path);
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    req.file.path = `${baseUrl}/uploads/${filename}`;
  }
  next();
};

const imageUpload = multer({
  storage: createStorage('images', ['jpg', 'jpeg', 'png', 'webp']),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const documentUpload = multer({
  storage: createStorage('documents', ['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls', 'doc', 'docx']),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const logoUpload = multer({
  storage: createStorage('logos', ['jpg', 'jpeg', 'png', 'webp', 'svg']),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const deleteImage = async (publicId) => {
  if (!hasCloudinary) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err);
  }
};

module.exports = { cloudinary, imageUpload, documentUpload, logoUpload, deleteImage, processUploadedFile };
