import mongoose from "mongoose";
import { type } from "os";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: Number, required: true, unique: true },
    status: { type: Boolean, default: false },

    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user" },

    cartData: { type: Object, default: {} },
    referralCode: { type: String, unique: true },

    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    selled: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    image: { type: String },

    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      zipcode: { type: String },
    },

    location: { type: String, default: "India" },
  },
  { minimize: false, timestamps: true }
);

const userModel = mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;
