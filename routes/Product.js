import express from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import User from "../models/User.js";
import isAuth, { isSeller, isAdmin } from "../middlewares/isAuth.middleware.js";
import { upload } from "../config/cloudinary.config.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

/* =======================
     GET ALL PRODUCTS
======================= */
router.get("/", async (req, res) => {
  try {
    console.log("GET /api/products called with query params:", req.query);

    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const search = req.query.search;
    const category = req.query.category;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined;
    const sortParam = req.query.sort;
    const order = req.query.order || 'desc';

    // Build filter object
    const filter = {};

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    if (category) {
      filter.mainCategory = { $regex: `^${category}$`, $options: 'i' };
    }

    if (minPrice !== undefined) {
      filter.price = { ...filter.price, $gte: minPrice };
    }

    if (maxPrice !== undefined) {
      filter.price = { ...filter.price, $lte: maxPrice };
    }

    console.log("Built filter:", JSON.stringify(filter, null, 2));

    // Build sort object
    let sort = { createdAt: -1 }; // default newest first

    if (sortParam === 'price') {
      sort = { price: order === 'asc' ? 1 : -1 };
    } else if (sortParam === 'newest') {
      sort = { createdAt: order === 'asc' ? 1 : -1 };
    }

    // Pagination
    const skip = (page - 1) * limit;
    const products = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('sellerId', 'username');

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    res.json({
      products,
      totalPages,
      currentPage: page,
      totalProducts
    });
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/* =======================
   GET PRODUCTS FOR SELLER
======================= */
router.get("/seller", isAuth, isSeller, async (req, res) => {
  try {
    const sellerId = req.userId || req.user?._id?.toString();
    if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ message: "Invalid seller ID format" });
    }
    const products = await Product.find({ sellerId }).lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* =======================
    GET PRODUCT BY ID
======================= */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid product ID format" });
  }

  try {
    const product = await Product.findById(id).populate(
      "sellerId",
      "username email"
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    
    // Ensure imageUrl is explicitly included for backward compatibility
    const productObj = product.toObject();
    if (product.images && product.images.length > 0) {
      const mainImage = product.images.find(img => img.isMain) || product.images[0];
      productObj.imageUrl = mainImage.url;
    } else {
      productObj.imageUrl = null;
    }
    
    res.json(productObj);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* =======================
    ADD NEW PRODUCT
======================= */
router.post("/", isAuth, isSeller, async (req, res) => {
  const { name, price, description, mainCategory, subcategory, discount, secondhand, imageUrl, images, sizes, colors } = req.body;
  if (!name || !price || !description || !mainCategory || !subcategory) {
    return res
      .status(400)
      .json({ message: "Name, price, description, mainCategory, and subcategory are required" });
  }

  // Handle images: accept images array or convert imageUrl to images array
  let productImages = [];
  if (images && Array.isArray(images) && images.length > 0) {
    productImages = images.map((img, index) => ({
      url: img.url,
      isMain: img.isMain !== undefined ? img.isMain : (index === 0),
      order: img.order !== undefined ? img.order : index
    }));
  } else if (imageUrl) {
    productImages = [{ url: imageUrl, isMain: true, order: 0 }];
  } else {
    return res.status(400).json({ message: "At least one image is required" });
  }

  try {
    const product = new Product({
      name,
      price,
      description,
      mainCategory,
      subcategory,
      discount: discount || 0,
      secondhand: secondhand || false,
      sellerId: req.userId,
      images: productImages,
      sizes: sizes || [],
      colors: colors || [],
    });
    await product.save();

    // Send confirmation email to seller
    // const seller = await User.findById(req.userId);
    // if (seller && seller.email) {
    //   await sendEmail({
    //     to: seller.email,
    //     subject: "Your product has been listed successfully!",
    //     html: `
    //       <h2>Product Listed!</h2>
    //       <p>Your product <strong>${product.name}</strong> has been successfully added to Restyle.</p>
    //       <p>Price: $${product.price}</p>
    //       <p>Start selling now!</p>
    //     `,
    //   });
    // }

    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    res.status(500).json({ message: "Failed to add product" });
  }
});

/* =======================
   UPLOAD PRODUCT IMAGE
======================= */
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const imageUrl = req.file.path; // Cloudinary URL
    res.status(200).json({ message: "Image uploaded successfully", imageUrl });
  } catch (err) {
    res.status(500).json({ message: "Failed to upload image" });
  }
});

/* =======================
     UPDATE PRODUCT IMAGE
 ======================= */
router.patch("/:id/image", isAuth, isSeller, async (req, res) => {
  try {
    const { imageUrl, images } = req.body;
    let updateImages = [];

    if (images && Array.isArray(images) && images.length > 0) {
      updateImages = images.map((img, index) => ({
        url: img.url,
        isMain: img.isMain !== undefined ? img.isMain : (index === 0),
        order: img.order !== undefined ? img.order : index
      }));
    } else if (imageUrl) {
      updateImages = [{ url: imageUrl, isMain: true, order: 0 }];
    } else {
      return res.status(400).json({ message: "Images array or imageUrl required" });
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, sellerId: req.userId },
      { images: updateImages },
      { new: true }
    );
    if (!product)
      return res.status(404).json({ message: "Product not found or unauthorized" });

    res.json({ message: "Product image updated successfully", product });
  } catch (err) {
    res.status(500).json({ message: "Failed to update product image" });
  }
});

/* =======================
     UPDATE PRODUCT DETAILS
======================= */
router.patch("/:id", isAuth, isSeller, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid product ID format" });
  }

  const { name, price, description, mainCategory, subcategory, discount, secondhand, imageUrl, images, sizes, colors } = req.body;

  // Validate required fields if provided
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ message: "Name cannot be empty" });
  }
  if (price !== undefined && (isNaN(price) || price < 0)) {
    return res.status(400).json({ message: "Price must be a positive number" });
  }
  if (description !== undefined && !description.trim()) {
    return res.status(400).json({ message: "Description cannot be empty" });
  }
  if (mainCategory !== undefined && !mainCategory.trim()) {
    return res.status(400).json({ message: "Main category cannot be empty" });
  }
  if (subcategory !== undefined && !subcategory.trim()) {
    return res.status(400).json({ message: "Subcategory cannot be empty" });
  }
  if (images !== undefined && (!Array.isArray(images) || images.length === 0)) {
    return res.status(400).json({ message: "Images must be a non-empty array" });
  }
  if (imageUrl !== undefined && typeof imageUrl !== 'string') {
    return res.status(400).json({ message: "Image URL must be a string" });
  }

  try {
    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (price !== undefined) updateFields.price = price;
    if (description !== undefined) updateFields.description = description.trim();
    if (mainCategory !== undefined) updateFields.mainCategory = mainCategory.trim().toLowerCase();
    if (subcategory !== undefined) updateFields.subcategory = subcategory.trim();
    if (discount !== undefined) updateFields.discount = discount;
    if (secondhand !== undefined) updateFields.secondhand = secondhand;
    if (images !== undefined) {
      updateFields.images = images.map((img, index) => ({
        url: img.url,
        isMain: img.isMain !== undefined ? img.isMain : (index === 0),
        order: img.order !== undefined ? img.order : index
      }));
    } else if (imageUrl !== undefined) {
      updateFields.images = [{ url: imageUrl.trim(), isMain: true, order: 0 }];
    }
    if (sizes !== undefined) updateFields.sizes = Array.isArray(sizes) ? sizes : [];
    if (colors !== undefined) updateFields.colors = Array.isArray(colors) ? colors : [];

    const product = await Product.findOneAndUpdate(
      { _id: id, sellerId: req.userId },
      updateFields,
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found or unauthorized" });
    }

    res.json({ message: "Product updated successfully", product });
  } catch (err) {
    res.status(500).json({ message: "Failed to update product" });
  }
});

/* =======================
   DELETE PRODUCT (SELLER)
======================= */
router.delete("/:id", isAuth, isSeller, async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      sellerId: req.userId,
    });
    if (!product)
      return res.status(404).json({ message: "Product not found or unauthorized" });

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete product" });
  }
});

/* =======================
   DELETE PRODUCT (ADMIN)
======================= */
router.delete("/admin/:id", isAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    await Product.findByIdAndDelete(id);
    res.json({ message: "Product deleted successfully by admin" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete product" });
  }
});

/* =======================
    GET LIKES
======================= */
router.get("/:id/likes", isAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const userId = req.userId;
    const liked = product.likes.includes(userId);
    const disliked = product.dislikes.includes(userId);

    res.json({
      likesCount: product.likes.length,
      dislikesCount: product.dislikes.length,
      liked,
      disliked
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =======================
    TOGGLE LIKE
======================= */
router.post("/:id/like", isAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const userId = req.userId;
    const index = product.likes.indexOf(userId);

    if (index === -1) product.likes.push(userId);
    else product.likes.splice(index, 1);

    await product.save();
    res.json({ likes: product.likes.length, liked: index === -1 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =======================
   TOGGLE DISLIKE
======================= */
router.post("/:id/dislike", isAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const userId = req.userId;
    const index = product.dislikes.indexOf(userId);

    if (index === -1) product.dislikes.push(userId);
    else product.dislikes.splice(index, 1);

    await product.save();
    res.json({ dislikes: product.dislikes.length, disliked: index === -1 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =======================
   ADD COMMENT
======================= */
router.post("/:id/comment", isAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: "Comment text required" });

  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { default: User } = await import("../models/User.js");
    const user = await User.findById(req.userId);

    product.comments.push({
      userId: req.userId,
      username: user?.username || "Unknown",
      text,
      createdAt: new Date(),
    });

    await product.save();
    res.json({ comments: product.comments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
