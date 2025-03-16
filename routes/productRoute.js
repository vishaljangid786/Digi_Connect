import express from "express";
import {
  listProducts,
  addProduct,
  removeProduct,
  singleProduct,
  fetchcategory,
  addReview,
  getReviews,
  deleteReview,
  listUserProducts,
} from "../controllers/productController.js";
import upload from "../middleware/multer.js";
import jwt from 'jsonwebtoken'

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized: Invalid token" });
  }
};

const productRouter = express.Router();

productRouter.post(
  "/add",
  upload.fields([
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
    { name: "image3", maxCount: 1 },
    { name: "image4", maxCount: 1 },
  ]),
  authMiddleware,
addProduct
);
productRouter.delete("/remove/:id", removeProduct);
productRouter.post("/single", singleProduct);
productRouter.post("/single/:id", singleProduct);
productRouter.get("/list", listProducts);
productRouter.get("/fetchcategories", fetchcategory);
productRouter.post("/addReview", addReview);
productRouter.get("/getReviews/:productId", getReviews);
productRouter.post("/deleteReview", deleteReview);
productRouter.get("/list/:userId", authMiddleware, listUserProducts);

export default productRouter;
