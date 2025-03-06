import mongoose from "mongoose";

const incomeLevelSchema = new mongoose.Schema(
  {
    levelName: {
      type: String,
      required: true,
      unique: true,
    },
    left: {
      type: String,
      required: true,
    },
    right: {
      type: String,
      required: true,
    },
    price: {
      type: String,
      required: true,
    },
  },
  { minimize: false, timestamps: true }
);

const IncomeLevel =
  mongoose.models.IncomeLevel ||
  mongoose.model("IncomeLevel", incomeLevelSchema);

export default IncomeLevel;
