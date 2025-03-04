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

const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});
export const sendOtp = async (req, res) => {
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
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("OTP sending error:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
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

/* --------Routes --------*/

// Route for user login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });

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
    const { name, email, phone, password, address } = req.body;
    let imageUrl = null;

    // Checking if the user already exists
    const exists = await userModel.findOne({ email });
    if (exists) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
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

    // Hashing the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Handling Profile Image Upload
    if (req.file) {
      imageUrl = await uploadImageToCloudinary(req.file.path); // Upload image & get URL
    }

    // Generating a unique referral code
    const referralCode = generateReferralCode();

    // Creating a new user
    const newUser = new userModel({
      name,
      email,
      phone,
      password: hashedPassword,
      referralCode,
      image: imageUrl, // Storing image URL
      address: {
        street: address?.street || "",
        city: address?.city || "",
        state: address?.state || "",
        country: address?.country || "",
        zipcode: address?.zipcode || "",
      },
    });

    const user = await newUser.save();

    // Creating a token
    const token = createToken(user._id);

    res.status(201).json({
      success: true,
      token,
      referralCode: user.referralCode,
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
    const { email, password } = req.body;

    // Check if the user exists
    const user = await userModel.findOne({ email });
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
        .json({ success: false, message: "Invalid password or email" });
    }

    // Generate JWT token with role
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role, // Include role in the token
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
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
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

    // const user = await userModel.findById(userId).select("image createdAt phone name email, referralCode");
    const user = await userModel.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

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

export {
  loginUser,
  updateRole,
  fetchAllUsers,
  registerUser,
  adminLogin,
  fetchReferralCode,
  fetchUserData,
  removeUser,
  authRole,
};
