import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import Cart from "../models/cartModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";

const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access" });
    }

    // Validate input
    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Product ID and quantity are required",
      });
    }

    const parsedQuantity = Number(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid quantity",
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Find or create the cart
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [{ productId, quantity: parsedQuantity }],
      });
    } else {
      if (!cart.items) {
        cart.items = [];
      }

      // Check if the product already exists in the cart
      const cartItem = cart.items.find(
        (item) => item.productId.toString() === productId
      );

      if (cartItem) {
        cartItem.quantity += parsedQuantity;
      } else {
        cart.items.push({ productId, quantity: parsedQuantity });
      }
    }

    await cart.save();

    // Populate product details before returning response
    await cart.populate({
      path: "items.productId",
      select: "name price image",
    });

    res.json({
      success: true,
      message: "Product added to cart",
      cart,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding to cart",
    });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user.userId || req.user.id;
    

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    const cartItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );

    if (!cartItem) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in cart" });
    }

    cartItem.quantity = quantity;
    await cart.save();
    await cart.populate("items.productId");

    res.json({ success: true, cart, message: "Cart Updated" });
  } catch (error) {
    console.error("Update cart error:", error);
    res.status(500).json({ success: false, message: "Error updating cart" });
  }
};

// get user cart data
const getCart = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select: "name price image category", // Select only required fields
    });

    res.json({
      success: true,
      cart: cart || { items: [] }, // Return an empty cart if no cart exists
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cart",
    });
  }
};



// Function to remove from cart
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body; 
    const userId = req.user.userId || req.user.id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Remove item from cart
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    );

    await cart.save();
    await cart.populate("items.productId");

    res.json({
      success: true,
      message: "Item removed successfully",
      cart,
    });
  } catch (error) {
    console.error("Error removing cart item:", error);
    res.status(500).json({
      success: false,
      message: "Error removing item from cart",
    });
  }
};

export { addToCart, updateCartItem, getCart, removeFromCart };
