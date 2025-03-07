import express from "express";
import multer from "multer";
const bannerRoute = express.Router();
import {
  uploadBanner,
  getBannerImage,
  deleteBanner,
} from "../controllers/banner.controller.js";
import { authRole } from "../controllers/userController.js";

const FILE_TYPE_MAP = {
  "image/png": "png",
  "image/jpg": "jpg",
  "image/jpeg": "jpeg",
};
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isValid = FILE_TYPE_MAP[file.mimetype];
    let uploadError = new Error("invalid image type");

    if (isValid) {
      uploadError = null;
    }
    cb(uploadError, "uploads/");
  },
  filename: (req, file, cb) => {
    const extension = FILE_TYPE_MAP[file.mimetype];
    cb(null, `${Date.now()}.${extension}`);
  },
});

const upload = multer({ storage: storage });

// bannerRoute.post('/', upload.fields([{ name: 'image', maxCount: 1 }]), uploadBanner)
bannerRoute.post("/", authRole("admin"), upload.single("image"), uploadBanner);
bannerRoute.get("/", getBannerImage);
bannerRoute.delete("/:id", authRole("admin"), deleteBanner);

export default bannerRoute;
