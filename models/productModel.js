import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  user: { type: String, required: true }, // User ID or Name
  rating: { type: Number, required: true, min: 1, max: 5 }, // 1-5 stars
  comment: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: Array, required: true },
  category: { type: String, required: true },
  subCategory: { type: String, required: true },
  color: { type: Array, required: true },
  sizes: { type: Array, required: true },
  bestseller: { type: Boolean },
  date: { type: Number, required: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  reviews: { type: [reviewSchema], default: [] },
  averageRating: { type: Number, default: 0 },
});

// Auto-update `averageRating` when a new review is added
productSchema.methods.calculateAverageRating = function () {
  if (this.reviews.length === 0) {
    this.averageRating = 0;
  } else {
    const total = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.averageRating = total / this.reviews.length;
  }
  return this.averageRating;
};

// Create Model
const productModel =
  mongoose.models.product || mongoose.model("Product", productSchema);

export default productModel;
