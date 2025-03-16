import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import Stripe from "stripe";
import razorpay from "razorpay";
import jwt from "jsonwebtoken";
import productModel from "../models/productModel.js";
import Cart from "../models/cartModel.js";

// global variables
const currency = "inr";
const deliveryCharge = 10;

// gateway initialize
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Placing orders using COD Method
const placeOrder = async (req, res) => {
  try {
    const { items, amount, address } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!items || items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }
    if (!address) {
      return res.json({ success: false, message: "Address is required" });
    }

    // const cart = await CartModel.findOne({ _id: cartId }).populate(
    //   "items.productId"
    // );

    // if (!cart) {
    //   return res.status(404).json({ message: "Cart not found" });
    // }

    // let totalCC = 0;

    // // Loop through items to process cc
    // const updatedItems = cart.items.map((item) => {
    //   if (item.productId && item.productId.cc) {
    //     const ccValue = item.productId.cc * item.quantity; // Multiply cc by quantity
    //     totalCC += ccValue; // Add to total
    //     return {
    //       ...item.toObject(),
    //       cc: ccValue, // Add calculated cc to each item
    //     };
    //   }
    //   return item.toObject(); // Return item unchanged if no cc found
    // });

    const populateItems = async (items) => {
      return await Promise.all(
        items.map(async (item) => {
          // Populate productId to get cc and createdBy
          const product = await productModel
            .findById(item.productId)
            .select("cc createdBy");

          return {
            ...item,
            cc: product?.cc || null, // Get cc
            createdBy: product?.createdBy || null, // Get createdBy
          };
        })
      );
    };

    const sellerData = await populateItems(items);
    // console.log(sellerData);

    // Create order
    const newOrder = new orderModel({
      userId,
      items,
      address,
      amount,
      paymentMethod: "COD",
      payment: false,
      date: new Date(),
      status: "Pending",
    });
    await newOrder.save();

    // Add order to buyer's orders list
    await userModel.findByIdAndUpdate(userId, {
      $push: { orders: newOrder._id },
    });

    // for (let i = 0; i < sellerData.length; i++) {
    //   if (sellerData[i]?.createdBy) {
    //     const getSeller = await userModel.findOne({
    //       _id: sellerData[i].createdBy,
    //     });
    //     await userModel.findByIdAndUpdate(sellerData[i].createdBy, {
    //       cc: getSeller.cc + sellerData[i].cc,
    //     });
    //   }
    // }

    // const updateSellers = async (sellerData) => {
    //   console.log("data", sellerData);
    //   await Promise.all(
    //     sellerData
    //       .filter((seller) => seller?.createdBy) // Ensure createdBy exists
    //       .map((seller) =>
    //         userModel.findByIdAndUpdate(seller.createdBy, {
    //           $inc: { cc: seller.cc }, // Increment cc directly
    //         })
    //       )
    //   );
    // };

    const updateSellers = async (sellerData) => {
      try {
        console.log("Updating sellers:", sellerData);

        await Promise.all(
          sellerData
            .filter(
              (seller) => seller?.createdBy && typeof seller.cc === "number"
            )
            .map(async (seller) => {
              // Call the function for the initial seller
              const updatedUser = await userModel.findByIdAndUpdate(
                seller.createdBy,
                { $inc: { cc: seller.cc || 0 } }, // Ensure cc exists
                { new: true } // Return updated document
              );

              console.log(
                `Updated cc for user ${seller.createdBy}:`,
                updatedUser?.cc
              );

              if (updatedUser?.referredBy) {
                await updateCCRecursively(updatedUser.referredBy, seller.cc || 0);
              }

            })
        );

        console.log("All sellers updated successfully!");
      } catch (error) {
        console.error("Error updating sellers:", error);
      }
    };

    await updateSellers(sellerData);

    const updateCCRecursively = async (userId, ccToAdd) => {
      if (!userId || ccToAdd <= 0) return;

      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        { $inc: { cc: ccToAdd } }, // Increase cc
        { new: true } // Return updated document
      );

      // Check if the user has a referredBy field
      if (updatedUser?.referredBy) {
        await updateCCRecursively(updatedUser.referredBy, ccToAdd); // Recursively update referredBy
      }
    };

    // Update each product's seller with the order info
    await Promise.all(
      items.map(async (item) => {
        const product = await productModel
          .findById(item.productId)
          .populate("createdBy");

        if (product?.createdBy) {
          await userModel.findByIdAndUpdate(product.createdBy, {
            $push: { selled: newOrder._id },
          });
        }
      })
    );

    // ✅ Reset user's cart in Cart collection
    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

    res.json({
      success: true,
      message: "Order Placed Successfully",
      order: newOrder,
    });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Placing orders using Stripe Method
const placeOrderStripe = async (req, res) => {
  try {
    const { userId, items, amount, address } = req.body;
    const { origin } = req.headers;

    const orderData = {
      userId,
      items,
      address,
      amount,
      paymentMethod: "Stripe",
      payment: false,
      date: Date.now(),
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    const line_items = items.map((item) => ({
      price_data: {
        currency: currency,
        product_data: {
          name: item.name,
        },
        unit_amount: item.price * 100,
      },
      quantity: item.quantity,
    }));

    line_items.push({
      price_data: {
        currency: currency,
        product_data: {
          name: "Delivery Charges",
        },
        unit_amount: deliveryCharge * 100,
      },
      quantity: 1,
    });

    const session = await stripe.checkout.sessions.create({
      success_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
      cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
      line_items,
      mode: "payment",
    });

    res.json({ success: true, session_url: session.url });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Verify Stripe
const verifyStripe = async (req, res) => {
  const { orderId, success, userId } = req.body;

  try {
    if (success === "true") {
      await orderModel.findByIdAndUpdate(orderId, { payment: true });
      await userModel.findByIdAndUpdate(userId, { cartData: {} });
      res.json({ success: true });
    } else {
      await orderModel.findByIdAndDelete(orderId);
      res.json({ success: false });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Placing orders using Razorpay Method
const placeOrderRazorpay = async (req, res) => {
  try {
    const { userId, items, amount, address } = req.body;

    const orderData = {
      userId,
      items,
      address,
      amount,
      paymentMethod: "Razorpay",
      payment: false,
      date: Date.now(),
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    const options = {
      amount: amount * 100,
      currency: currency.toUpperCase(),
      receipt: newOrder._id.toString(),
    };

    await razorpayInstance.orders.create(options, (error, order) => {
      if (error) {
        console.log(error);
        return res.json({ success: false, message: error });
      }
      res.json({ success: true, order });
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

const verifyRazorpay = async (req, res) => {
  try {
    const { userId, razorpay_order_id } = req.body;

    const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);
    if (orderInfo.status === "paid") {
      await orderModel.findByIdAndUpdate(orderInfo.receipt, { payment: true });
      await userModel.findByIdAndUpdate(userId, { cartData: {} });
      res.json({ success: true, message: "Payment Successful" });
    } else {
      res.json({ success: false, message: "Payment Failed" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// All Orders data for Admin Panel
const allOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({});
    res.json({ success: true, orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// User Order Data For Forntend

const userOrders = async (req, res) => {
  try {
    // Get token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access" });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId;

    // Find orders associated with the user
    const orders = await orderModel.find({ userId }).sort({ date: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getSingleOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await orderModel
      .findById(id)
      .populate("userId") // ✅ Fetch user details
      .populate({
        path: "items.productId",
        model: "Product", // ✅ Ensure it's fetching from the correct model
      });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// update order status from Admin Panel
const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({
        success: false,
        message: "Missing orderId or status",
      });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.status = status;
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order status updated",
      order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// delete order from admin panel
const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    await orderModel.findByIdAndDelete(orderId);
    res.json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export {
  verifyRazorpay,
  verifyStripe,
  placeOrder,
  placeOrderStripe,
  placeOrderRazorpay,
  allOrders,
  userOrders,
  getSingleOrder,
  updateStatus,
  deleteOrder,
};
