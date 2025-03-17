import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import crypto from "crypto";
import { log } from "console";
import productModel from "../models/productModel.js";
import OTP from "../models/otpModel.js";
import nodemailer from "nodemailer";
import otpGenerator from "otp-generator";
import IncomeLevel from "../models/incomeLevel.js";
import Razorpay from "razorpay";

const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create a Fund Account for the User’s UPI ID
const createFundAccount = async (userName, upiId) => {
  try {
    const fundAccount = await razorpay.fundAccounts.create({
      contact: {
        name: userName,
        type: "customer",
      },
      account_type: "vpa",
      vpa: {
        address: upiId,
      },
    });

    return fundAccount.id; // Return Fund Account ID
  } catch (error) {
    console.error("Error creating fund account:", error);
    throw new Error("Failed to create fund account");
  }
};

const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    // Generate OTP
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
    });

    // Save OTP in database
    await OTP.findOneAndUpdate(
      { email },
      { otp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // Send OTP via Email
    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: "🔐Your Secure OTP Code - Action Required",
      text: `Dear User, 

Your One-Time Password (OTP) for authentication is: ${otp}. 

For security reasons, this code will expire in 5 minutes. Please do not share it with anyone.

If you did not request this code, please ignore this email.

Best regards,  
Vk Marketing`,
    };
    // console.log(otp);

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("OTP sending error:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};
const verifyOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Email and OTP are required" });
    }

    const otpRecord = await OTP.findOne({ email, otp });

    if (!otpRecord) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // OTP verified, delete it from DB
    await OTP.deleteOne({ email });

    // If a new password is provided, update user's password
    if (newPassword) {
      const user = await userModel.findOne({ email });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Hash the new password before saving
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      await user.save();
    }

    res
      .status(200)
      .json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    console.error("OTP verification error:", error);
    res
      .status(500)
      .json({ success: false, message: "OTP verification failed" });
  }
};

const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};
// Function to generate a unique referral code
const generateReferralCode = () => {
  return crypto.randomBytes(6).toString("hex").toUpperCase(); // Generates a random 12-character alphanumeric code
};

const generateUID = () => {
  // Generate 2 random uppercase letters
  const letters = String.fromCharCode(
    65 + Math.floor(Math.random() * 26),
    65 + Math.floor(Math.random() * 26)
  );

  // Generate 6 random digits
  const numbers = crypto.randomInt(100000, 999999).toString();

  return `${letters}${numbers}`;
};

/* --------Routes --------*/

// Route for user login
const loginUser = async (req, res) => {
  try {
    const { uid, password } = req.body;

    if (!uid || !password) {
      return res.status(400).json({
        error: "missingField require",
        message: {
          uid: !uid ? "uid is require" : undefined,
          password: !password ? "password is required" : undefined,
        },
      });
    }

    const user = await userModel.findOne({ uid });

    if (!user) {
      return res.json({ success: false, message: "User doesn't exists" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      // Create token with userId instead of id
      const token = jwt.sign(
        {
          userId: user._id, // Changed from id to userId
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.json({ success: true, token });
    } else {
      res.json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Route for user register
const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      address,
      referralCode,
      role,
      option,
    } = req.body;

    // Checking if the user already exists
    const checkExistdata = await userModel.findOne({
      $or: [{ phone }, { email }], // Check if either phone or email exists
    });

    if (checkExistdata) {
      // Just check if the user exists
      return res
        .status(409)
        .json({ message: "User already exists with the same credentials" });
    }

    // Validating email format & strong password
    if (!validator.isEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Please enter a valid email" });
    }
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }
    if (!validator.isMobilePhone(phone, "any", { strictMode: false })) {
      return res
        .status(400)
        .json({ success: false, message: "Please enter a valid phone number" });
    }

    if (option !== "left" && option !== "right") {
      return res
        .status(400)
        .json({ message: "Option must be 'left' or 'right'" });
    }

    // Hashing the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generating a unique referral code
    const newReferralCode = generateReferralCode();
    const UID = generateUID();

    // Find the referring user (if referralCode is provided)
    let referredByUser = null;
    if (referralCode) {
      referredByUser = await userModel.findOne({ referralCode });
      if (!referredByUser) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid referral code" });
      }
    }

    // Creating a new user
    const newUser = new userModel({
      name,
      email,
      phone,
      password: hashedPassword,
      referralCode: newReferralCode,
      referredBy: referredByUser ? referredByUser._id : null, // Save referrer's ID
      uid: UID,
      role: role ? "admin" : "user",
      option: option,
      address: {
        street: address?.street || "",
        city: address?.city || "",
        state: address?.state || "",
        country: address?.country || "",
        zipcode: address?.zipcode || "",
      },
    });

    const user = await newUser.save();

    if (referralCode) {
      await userModel.findByIdAndUpdate(
        referredByUser._id,
        { $push: { team: user._id } }, // Push userId into team array
        { new: true }
      );
    }

    // Creating a token
    const token = createToken(user._id);

    res.status(201).json({
      success: true,
      token,
      UID: user.uid,
      referralCode: user.referralCode,
      referredBy: referredByUser ? referredByUser.email : null, // Send referredBy email in response
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const removeUser = async (req, res) => {
  try {
    const { id } = req.body;

    // Check if the requesting user has admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete users",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find the user first
    const user = await userModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete all products associated with the user
    await productModel.deleteMany({ userId: id });

    // Delete the user
    await userModel.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "User and their products deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Route for admin login
const adminLogin = async (req, res) => {
  try {
    const { uid, password } = req.body;

    const user = await userModel.findOne({ uid });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid UID or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Send token and user info
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const checkrefferalcode = async (req, res) => {
  try {
    const { referralCode } = req.body;

    const user = await userModel.findOne({ referralCode });
    if (user) {
      return res.json({ success: true, message: "Referral code is valid." });
    } else {
      return res.json({ valid: false, message: "Invalid referral code." });
    }
  } catch (error) {
    return res.status(500).json({ message: "Server error." });
  }
};

const authRole = (role) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(403)
        .json({ success: false, message: "No token provided" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if the user has the correct role
      if (decoded.role !== role) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      req.user = decoded; // Attach user data to request
      next();
    } catch (error) {
      console.error("Auth Role Error:", error);
      res.status(401).json({ success: false, message: "Invalid token" });
    }
  };
};

// Route to fetch referral code
const fetchReferralCode = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId; // Get userId from auth middleware
    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      referralCode: user.referralCode,
    });
  } catch (error) {
    console.error("Error fetching referral code:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching referral code",
    });
  }
};

const getReferredUsers = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId; // Get logged-in user ID from middleware

    // Find users referred by this user
    const referredUsers = await userModel
      .find({ referredBy: userId })
      .select("name email createdAt");

    res.status(200).json({
      success: true,
      count: referredUsers.length,
      referredUsers,
    });
  } catch (error) {
    console.error("Error fetching referred users:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching referred users",
    });
  }
};

const addReferenceMember = async (req, res) => {
  const { name, phone, email, pincode, password, option } = req.body;
  const userId = req.user.userId || req.user.id;
  console.log("added id", userId);
  try {
    if (!name || !phone || !email || !pincode || !password) {
      return res.status(400).json({
        error: "MissingField required",
        message: {
          name: !name ? "name is required" : undefined,
          phone: !phone ? "phone is required" : undefined,
          email: !email ? "email is required" : undefined,
          pincode: !pincode ? "pincode is required" : undefined,
          password: !password ? "password is required" : undefined,
          option: !option ? "option must be 'left' or 'right'" : undefined, // Fix here
        },
      });
    }

    if (option !== "left" && option !== "right") {
      return res
        .status(400)
        .json({ message: "Option must be 'left' or 'right'" });
    }

    const checkExistdata = await userModel.findOne({
      $or: [{ phone }, { email }], // Check if either phone or email exists
    });

    if (checkExistdata) {
      // Just check if the user exists
      return res
        .status(409)
        .json({ message: "User already exists with the same credentials" });
    }

    // Generating a unique referral code
    const newReferralCode = generateReferralCode();
    const UID = generateUID();

    // Hashing the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const referrer = await userModel.findById(userId);
    if (!referrer) {
      return res.status(404).json({ message: "Referrer user not found" });
    }

    // Creating a new user
    const newUser = new userModel({
      name,
      email,
      phone,
      password: hashedPassword,
      referralCode: newReferralCode,
      referredBy: userId, // Save referrer's ID
      option: option,
      uid: UID,
      address: {
        street: "",
        city: "",
        state: "",
        country: "",
        zipcode: pincode,
      },
    });

    const user = await newUser.save();

    await userModel.findByIdAndUpdate(
      userId,
      { $push: { team: user._id } }, // Push userId into team array
      { new: true }
    );

    res.status(201).json({ message: "add team member successful", user });
  } catch (error) {
    console.error("addReferenceMember Error", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const fetchAllUsers = async (req, res) => {
  try {
    const users = await userModel.find().select("-password"); // Exclude password field

    if (!users || users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No users found" });
    }

    res.json({ success: true, users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
const updateRole = async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res
        .status(400)
        .json({ success: false, message: "Missing userId or role" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    user.role = role;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Role updated successfully" });
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getTeamMember = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const userTeam = await userModel.findById(userId).populate("team");
    // console.log("user team", userTeam.team);
    // Count "left" and "right" options
    const count = userTeam.team.reduce(
      (acc, user) => {
        if (user.option === "left") acc.left += 1;
        if (user.option === "right") acc.right += 1;
        return acc;
      },
      { left: 0, right: 0 }
    );

    res.status(200).json({
      message: "Get All Team Data",
      left: count.left,
      right: count.right,
      total: userTeam.team.length,
    });
  } catch (error) {
    console.error("getTeamMember Error", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getOptionTeam = async (req, res) => {
  try {
    const { option } = req.body;
    const userId = req.user.userId || req.user.id;
    if (option !== "left" && option !== "right" && option !== "total") {
      return res
        .status(400)
        .json({ message: "Option must be 'left', 'right' and total" });
    }
    // console.log("userId", userId);
    const userTeam = await userModel.findById(userId).populate("team");

    let User;
    if (option == "left" || option == "right") {
      // Filter users with option "left"
      User = userTeam.team.filter((team) => team.option === option);
    } else {
      User = userTeam.team;
    }

    res.status(200).json({ message: `get ${option} Team Member`, user: User });
  } catch (error) {
    console.error("getOptionTeam Error", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updatecc = async (req, res) => {
  const { userId, totalcc } = req.body;

  if (!userId || totalcc === undefined) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  try {
    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { $set: { cc: totalcc } },
      { new: true }
    );
    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Total CC updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating CC:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Fetch multiple users by their IDs
const fetchMultipleUsers = async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user IDs" });
    }

    // Fetch users whose IDs are in the provided list, excluding passwords
    const users = await userModel
      .find({ _id: { $in: userIds } })
      .select("-password");

    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching multiple users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const fetchUserData = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId;

    const user = await userModel.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Fetch all income levels
    const levelModel = await IncomeLevel.find({});

    for (let i = 0; i < levelModel.length; i++) {
      const level = levelModel[i]; // Store current level

      // Check if the level already exists in user's level array
      if (!user.level.includes(level._id)) {
        // Check if user has enough cc to unlock this level
        if (user.cc >= level.left) {
          user.level.push(level._id);
          user.amount += level.price; // Corrected the reference to level.price
        }
      }
    }

    // Save the user only once after the loop (more efficient)
    await user.save();
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Error in fetchUserData:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user data",
    });
  }
};

const blockUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    const user = await userModel.findByIdAndUpdate(
      userId,
      { $set: { blocked: true } },
      { new: true }
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res
      .status(200)
      .json({ success: true, message: "User blocked successfully" });
  } catch (error) {
    console.error("Error blocking user:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
const updateblockUser = async (req, res) => {
  try {
    const { userId, status } = req.body;
    console.log("userId",userId);
    console.log("status",status);
    if (!userId) {
      return res
       .status(400)
       .json({ success: false, message: "User ID is required" });
    }
    const user = await userModel.findByIdAndUpdate(
      userId,
      { $set: { blocked: status } },
      { new: true }
    );
    if (!user) {
      return res
       .status(404)
       .json({ success: false, message: "User not found" });
    }
    return res
      .status(200)
      .json({ success: true, message: "User blocked successfully" });
  }
  catch (error) {
    console.error("Error blocking user:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};


// withdraw payment
const withdraw = async (req, res) => {
  try {
    const { userId, amount, upiId } = req.body;

    if (!userId || !amount || !upiId) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required!" });
    }

    if (amount < 500) {
      return res
        .status(400)
        .json({ success: false, message: "Minimum withdrawal is ₹500" });
    }

    // 1️⃣ Find user
    const user = await userModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (user.amount < amount) {
      return res
        .status(400)
        .json({ success: false, message: "Insufficient balance" });
    }

    // 2️⃣ Create Fund Account for UPI ID
    const fundAccountId = await createFundAccount(user.name, upiId);

    // 3️⃣ Initiate Payout
    const payout = await razorpay.payouts.create({
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
      amount: amount * 100, // Convert to paise
      currency: "INR",
      mode: "UPI",
      purpose: "Withdrawal",
      fund_account_id: fundAccountId, // Use the generated fund account ID
      narration: "User withdrawal",
    });

    // 4️⃣ Deduct the amount only after a successful payout
    user.amount -= amount;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Withdrawal successful, amount sent to UPI ID",
      payoutId: payout.id,
    });
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const withdrawInAccount = async (req, res) => {
  try {
    const { userId, amount, account_number, ifsc_code, account_holder_name } =
      req.body;

    // Validate required fields
    if (
      !userId ||
      !amount ||
      !account_number ||
      !ifsc_code ||
      !account_holder_name
    ) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    // Ensure minimum withdrawal amount is ₹500
    if (amount < 500) {
      return res
        .status(400)
        .json({ success: false, message: "Minimum withdrawal amount is ₹500" });
    }

    // Check if user exists
    const user = await userModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if the user has enough balance
    if (user.amount < amount) {
      return res
        .status(400)
        .json({ success: false, message: "Insufficient balance" });
    }

    // Deduct amount from user's balance and save
    user.amount -= amount;
    await user.save();

    // Create a payout request
    const payout = await razorpay.payouts.create({
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER, // Razorpay business account
      amount: amount * 100, // Convert to paise
      currency: "INR",
      mode: "IMPS",
      purpose: "payout",
      fund_account: {
        account_type: "bank_account",
        bank_account: {
          name: account_holder_name,
          ifsc: ifsc_code,
          account_number: account_number,
        },
      },
      notes: {
        userId: userId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Withdrawal successful",
      transactionId: payout.id,
      credited_to: {
        account_holder_name,
        account_number,
        ifsc_code,
        amount,
      },
    });
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export {
  checkrefferalcode,
  getReferredUsers,
  blockUser,
  updateblockUser,
  fetchMultipleUsers,
  sendOtp,
  withdraw,
  withdrawInAccount,
  verifyOtp,
  updatecc,
  loginUser,
  updateRole,
  fetchAllUsers,
  registerUser,
  adminLogin,
  fetchReferralCode,
  fetchUserData,
  removeUser,
  authRole,
  addReferenceMember,
  getTeamMember,
  getOptionTeam,
};
