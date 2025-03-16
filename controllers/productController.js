import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";
import userModel from "../models/userModel.js";
import mongoose from "mongoose";

// function for add product

const addProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      subCategory,
      color,  
      cc,
      sizes,
      bestseller,
    } = req.body;
    

    // Ensure user is authenticated
    if (!req.user.userId) {
      console.log("User data in request:", req.user);
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid user data",
      });
    }

    const userId = req.user.userId;

    // Validate required fields
    if (
      !name ||
      !description ||
      !price ||
      !category ||
      !cc||
      !subCategory ||
      !color ||
      !sizes
    ) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    // Handle images
    const images = ["image1", "image2", "image3", "image4"]
      .map((key) => req.files[key] && req.files[key][0])
      .filter(Boolean);

    if (images.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least one image is required" });
    }

    // Upload images to Cloudinary
    let imagesUrl = await Promise.all(
      images.map(async (item) => {
        let result = await cloudinary.uploader.upload(item.path, {
          resource_type: "image",
        });
        return result.secure_url;
      })
    );

    // Create product data
    const productData = {
      name,
      description,
      category,
      price: Number(price),
      subCategory,
      cc: Number(cc),
      color,
      bestseller: bestseller === "true",
      sizes: Array.isArray(sizes) ? sizes : JSON.parse(sizes || "[]"),
      image: imagesUrl,
      date: Date.now(),
      createdBy: userId,
    };

    // Save product
    const product = new productModel(productData);
    await product.save();

    // Add product to user's products array
    await userModel.findByIdAndUpdate(
      userId,
      { $push: { products: product._id } },
      { new: true }
    );

    res.status(201).json({
      success: true,
      message: "Product Added",
      product,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// function for list product
const listProducts = async (req, res) => {
  try {
    const products = await productModel
      .find({})
      .populate("createdBy", "name location address");
    res.json({ success: true, products });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};
// function for removing product
const removeProduct = async (req, res) => {
  try {
    const productId = req.params.id || req.body.id; // Get ID from params OR body

    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Product ID is required" });
    }

    await productModel.findByIdAndDelete(productId);
    res.json({ success: true, message: "Product Removed" });
  } catch (error) {
    console.error("Error removing product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// function for single product info
const singleProduct = async (req, res) => {
  try {
    const { productId } = req.body || req.params; 
    console.log(productId);
    

    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Product ID is required" });
    }

    const product = await productModel
      .findById(productId)
      .populate("createdBy", "name email location address");

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, product });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const fetchcategory = async (req, res) => {
  try {
    // Aggregate to get unique categories and subcategories
    const result = await productModel.aggregate([
      {
        $group: {
          _id: null, // No need to group by any field
          categories: { $addToSet: "$category" }, // Collect unique categories
          subCategories: { $addToSet: "$subCategory" }, // Collect unique subcategories
        },
      },
    ]);

    // Send the result as a response
    if (result.length > 0) {
      return res.json({
        success: true,
        categories: result[0].categories,
        subCategories: result[0].subCategories,
      });
    } else {
      return res.json({
        success: false,
        message: "No categories or subcategories found",
      });
    }
  } catch (err) {
    console.error("Error fetching categories and subcategories:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const addReview = async (req, res) => {
  try {
    let { productId, user, rating, comment } = req.body;

    // Ensure productId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.json({ success: false, message: "Invalid Product ID" });
    }

    const product = await productModel.findById(productId);
    if (!product) {
      return res.json({ success: false, message: "Product not found" });
    }

    // Check if the user has already reviewed
    const existingReview = product.reviews.find(
      (review) => review.user.toString() === user
    );

    if (existingReview) {
      // Update the existing review
      existingReview.rating = Number(rating);
      existingReview.comment = comment;
      existingReview.date = new Date();
    } else {
      // Add new review
      const newReview = {
        user,
        rating: Number(rating),
        comment,
        date: new Date(),
      };
      product.reviews.push(newReview);
    }

    // Recalculate average rating
    product.calculateAverageRating();

    await product.save();
    res.json({
      success: true,
      message: "Review added/updated successfully",
      product,
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Fetch reviews for a product
const getReviews = async (req, res) => {
  try {
    const { productId } = req.params; // Getting from params instead of body

    // Add validation for productId
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    // Validate if productId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Product ID format",
      });
    }

    const product = await productModel.findById(
      productId,
      "reviews averageRating"
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      reviews: product.reviews,
      averageRating: product.averageRating,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching reviews",
    });
  }
};

// Delete a review from a product
const deleteReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.body;
    const product = await productModel.findById(productId);
    if (!product) {
      return res.json({ success: false, message: "Product not found" });
    }

    // Filter out the review to be deleted
    product.reviews = product.reviews.filter(
      (review) => review._id.toString() !== reviewId
    );

    // Recalculate average rating
    product.calculateAverageRating();

    await product.save();
    res.json({
      success: true,
      message: "Review deleted successfully",
      product,
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Add this new function to fetch products by user ID
const listUserProducts = async (req, res) => {
  try {
    const { userId } = req.params;

    const products = await productModel.find({ createdBy: userId });
    res.json({ success: true, products });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export {
  listProducts,
  addProduct,
  removeProduct,
  singleProduct,
  fetchcategory,
  addReview,
  getReviews,
  deleteReview,
  listUserProducts,
};
