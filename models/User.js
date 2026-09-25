import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true, required: true },
  password: String,
  role: { type: String, default: "user" },
  avatar: { type: String, default: "/default-avatar.png" },
  bio: { type: String, default: "" },
  displayName: { type: String },
  location: { type: String },
  website: { type: String },
  banner: { type: String, default: "/default-banner.png" },
  subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  subscribing: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
  cart: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      quantity: { type: Number, default: 1 }
    }
  ],
  favorites: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    }
  ],
  userFavorites: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],
  notificationPreferences: {
    message: { type: Boolean, default: true },
    order: { type: Boolean, default: true },
    like: { type: Boolean, default: true },
    system: { type: Boolean, default: true }
  }
});

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});


UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", UserSchema);
