import mongoose from "mongoose";

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
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      default: null,
    },
    cc: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    uid: String,
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    selled: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],

    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      zipcode: { type: String },
    },
    option: { type: String, enum: ["left", "right", ""], default: "" },
    team: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],

    location: { type: String, default: "India" },
  },
  { minimize: false, timestamps: true }
);

const userModel = mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;
