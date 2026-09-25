import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

dotenv.config(); // Make sure this is first

console.log("Cloudinary envs:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    // folder: 'uploads', // Upload to root for now
    // allowed_formats: ['jpg', 'png', 'jpeg', 'svg'], // Allow any format for now
  },
});

const upload = multer({ storage });

const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('Deleted from Cloudinary:', result);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
  }
};

export { upload, deleteFromCloudinary };
