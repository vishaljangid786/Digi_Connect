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
  getReferredUsers,
  addReferenceMember,
  getTeamMember,
  getOptionTeam,
  updatecc,
  fetchMultipleUsers,
  checkrefferalcode,
  blockUser,
  updateblockUser,
  withdraw,
  withdrawInAccount,
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
// userRouter.get("/fetchallusers", authRole("admin"), fetchAllUsers);
userRouter.get("/fetchallusers", fetchAllUsers);
userRouter.put("/updateRole", authRole("admin"), updateRole);
userRouter.get("/referalcode", authUser, fetchReferralCode);
userRouter.get("/fetchuserdata", authUser, fetchUserData);
userRouter.delete("/deleteuser", authRole("admin"), removeUser);
userRouter.post("/sendOtp", sendOtp);
userRouter.post("/verifyOtp", verifyOtp);

userRouter.get("/referred", authUser, getReferredUsers);
userRouter.post("/addReferenceMember", authUser, addReferenceMember);
userRouter.get("/getTeamMember", authUser, getTeamMember);
userRouter.get("/getOptionTeam", authUser, getOptionTeam);
userRouter.put("/updatecc", authUser, updatecc);
userRouter.put("/updateBlocked",authRole("admin"),updateblockUser);
userRouter.post("/check-referral", checkrefferalcode);
userRouter.post("/block", authUser,blockUser);
userRouter.post("/fetchMultipleUsers", authUser, fetchMultipleUsers);
userRouter.post("/withdraw-upi", authUser, withdraw);
userRouter.post('withdraw-bank', authUser, withdrawInAccount);

export default userRouter;
