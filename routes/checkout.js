import express from "express";
import Stripe from "stripe";
import { sendEmail } from "../utils/sendEmail.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Order from "../models/order.model.js";
import isAuth from "../middlewares/isAuth.middleware.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // Add this to .env

router.post("/create-checkout-session", isAuth, async (req, res) => {
  const { items } = req.body;
  const userId = req.user.id;
  try {
    const line_items = items.map(item => ({
      price_data: {
        currency: "usd", // USD for testing
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100), // Stripe expects the smallest currency unit as integer
      },
      quantity: parseInt(item.quantity),
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: {
        userId: userId
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Stripe Webhook
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("Checkout session completed:", session.id, "Metadata:", session.metadata);

    // Commented out CV payment handling since CV uploading is now free
    /*
    if (session.metadata?.type === "cv") {
      const cvId = session.metadata.cvId;
      console.log(`Processing CV payment for cvId: ${cvId}`);
      try {
        const cv = await CV.findById(cvId);
        if (cv) {
          cv.isPublished = true;
          await cv.save();
          console.log(`CV ${cvId} published successfully`);
        } else {
          console.error(`CV ${cvId} not found`);
        }
      } catch (err) {
        console.error("Error publishing CV:", err);
      }
      return res.json({ received: true });
    }
    */

    // Retrieve session with line items for product purchases
    const sessionWithLineItems = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items"],
    });

    const lineItems = sessionWithLineItems.line_items.data;

    // Calculate total amount
    const totalAmount = session.amount_total / 100;

    // Get userId from metadata
    const userId = session.metadata?.userId;
    if (!userId) {
      console.error("User ID not found in session metadata");
      return res.status(400).send("User ID missing");
    }

    // Create Order
    const order = new Order({
      amount: totalAmount,
      user: userId,
      sessionId: session.id,
      status: 'placed'
    });
    await order.save();

    // Process each item
    for (const item of lineItems) {
      const productName = item.price.product_data?.name || "Unknown Product";
      const quantity = item.quantity;
      const amount = item.amount_total / 100; // Convert from cents

      // Find product by name (assuming unique names, or better to store product ID in metadata)
      const product = await Product.findOne({ name: productName }).populate("sellerId");

      if (product && product.sellerId) {
        // Email to seller
        // await sendEmail({
        //   to: product.sellerId.email,
        //   subject: "Your product has been purchased!",
        //   html: `
        //     <h2>Congratulations!</h2>
        //     <p>Your product <strong>${product.name}</strong> has been purchased.</p>
        //     <p>Quantity: ${quantity}</p>
        //     <p>Total: $${amount}</p>
        //     <p>Thank you for using Restyle!</p>
        //   `,
        // });

        // Email to buyer (if customer email available)
        // if (session.customer_details?.email) {
        //   await sendEmail({
        //     to: session.customer_details.email,
        //     subject: "Purchase Confirmation - Restyle",
        //     html: `
        //       <h2>Thank you for your purchase!</h2>
        //       <p>You have successfully purchased <strong>${product.name}</strong>.</p>
        //       <p>Quantity: ${quantity}</p>
        //       <p>Total: $${amount}</p>
        //       <p>Enjoy your new item!</p>
        //     `,
        //   });
        // }
      }
    }
  }

  res.json({ received: true });
});

export default router;
