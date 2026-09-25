import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import connectToDb from "../db/connectToDB.js";

const callbackUrl =
  process.env.NODE_ENV === "production"
    ? process.env.GOOGLE_CALLBACK_URL
    : process.env.GOOGLE_CALLBACK_URL_LOCAL;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: callbackUrl,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        await connectToDb();

        const email = profile.emails[0].value;

        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            username: profile.displayName || email.split("@")[0],
            email,
            avatar: profile.photos[0].value,
            role: "buyer",
          });
        }

        const token = jwt.sign(
          { id: user._id, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        done(null, { user, token });
      } catch (err) {
        done(err, null);
      }
    }
  )
);
