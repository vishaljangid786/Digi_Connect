import mongoose from "mongoose";

const incomeLevelSchema = new mongoose.Schema(
  {
    levelName: {
      type: String,
      required: true,
      unique: true,
    },
    left: {
      type: Number,
      required: true,
    },
    levelType: {
      type: String,
      required: true
    },
    right: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { minimize: false, timestamps: true }
);

const IncomeLevel =
  mongoose.models.IncomeLevel ||
  mongoose.model("IncomeLevel", incomeLevelSchema);

export default IncomeLevel;
