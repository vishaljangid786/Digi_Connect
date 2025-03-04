import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    name: String,
    number: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    pincode: { type: String },
    addhar: String,
    option: { type: String, enum: ["left", "right"] },
  },
  { minimize: false, timestamps: true }
);

const TeamsModel = mongoose.models.Teams || mongoose.model("Teams", teamSchema);

export default TeamsModel;
