import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import connectToDatabase from "../db/connectToDB.js";

const callbackURL =
  process.env.NODE_ENV === "production"
    ? process.env.GOOGLE_CALLBACK_URL
    : process.env.GOOGLE_CALLBACK_URL_LOCAL;

// Only initialize Google strategy if environment variables are available
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          await connectToDatabase();

          const email = profile.emails[0].value;
          const fullName = profile.displayName;
          const avatar = profile.photos[0].value;

          let user = await User.findOne({ email });

          if (!user) {
            // Create new user if not exists
            user = new User({
              username: fullName || email.split("@")[0],
              email,
              avatar,
              role: "buyer",
            });
            await user.save();
          }

          // Generate JWT token
          const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
          );

          // Pass user + token to callback
          done(null, { user, token });
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
} else {
  console.warn("Google OAuth credentials not found. Google login will be disabled.");
}

passport.serializeUser((obj, done) => {
  done(null, obj);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

export default passport;
