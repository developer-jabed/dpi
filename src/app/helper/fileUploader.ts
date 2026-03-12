import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v2 as cloudinary } from 'cloudinary'
import config from '../../config'

// ensure uploads folder exists
const uploadPath = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true })
}

/* ---------------- DISK STORAGE ---------------- */

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`)
  },
})

/* ---------------- MEMORY STORAGE ---------------- */

const memoryStorage = multer.memoryStorage()

/* ---------------- MULTER INSTANCES ---------------- */

// disk upload (image/file → cloudinary)
const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
})

// memory upload (PDF parsing / buffer processing)
const uploadToMemory = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ]

    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`))
    }
  },
})

/* ---------------- CLOUDINARY CONFIG ---------------- */

cloudinary.config({
  cloud_name: config.cloudinary.cloud_name,
  api_key: config.cloudinary.api_key,
  api_secret: config.cloudinary.api_secret,
})

/* ---------------- CLOUDINARY UPLOAD ---------------- */

const uploadToCloudinary = async (file: Express.Multer.File) => {
  try {
    const uploadSource = file.path
      ? file.path
      : `data:${file.mimetype};base64,${file.buffer.toString('base64')}`

    const result = await cloudinary.uploader.upload(uploadSource, {
      public_id: file.originalname.split('.')[0],
      resource_type: 'auto',
    })

    return result
  } catch (error) {
    console.error('Cloudinary Upload Error:', error)
    throw error
  }
}

/* ---------------- EXPORT ---------------- */

export const fileUploader = {
  upload,           // disk upload
  uploadToMemory,   // memory upload
  uploadToCloudinary,
}