import express from "express";
import {
  fetchReferralCode,
  loginUser,
  registerUser,
  adminLogin,
  fetchUserData,
  authRole,
  fetchAllUsers,
  removeUser,
  sendOtp,
  verifyOtp,
  updateRole,
} from "../controllers/userController.js";
import upload from "../middleware/multer.js";
import authUser from "../middleware/auth.js";

const userRouter = express.Router();

userRouter.post(
  "/register",
  upload.fields([{ name: "image", maxCount: 1 }]),
  registerUser
);
userRouter.post("/login", loginUser);
userRouter.post("/admin", adminLogin);
userRouter.get("/admin/dashboard", authRole("admin"), (req, res) => {
  res.json({ success: true, message: "Welcome to the admin dashboard!" });
});

userRouter.get("/seller/dashboard", authRole("seller"), (req, res) => {
  res.json({ success: true, message: "Welcome to the seller dashboard!" });
});
userRouter.get("/fetchallusers", authRole("admin"), fetchAllUsers);
userRouter.put("/updateRole", authRole("admin"), updateRole);
userRouter.get("/referalcode", authUser, fetchReferralCode);
userRouter.get("/fetchuserdata",authUser, fetchUserData);
userRouter.delete("/deleteuser", authRole("admin"), removeUser);
userRouter.post("/sendOtp", sendOtp);
userRouter.post("/verifyOtp", verifyOtp);


export default userRouter;
