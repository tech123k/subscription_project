const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const createStorage = (folder, allowedFormats) =>
  new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `erp/${folder}`,
      allowed_formats: allowedFormats,
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    },
  });

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
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err);
  }
};

module.exports = { cloudinary, imageUpload, documentUpload, logoUpload, deleteImage };
