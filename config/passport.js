import passport from "passport";
import "./google.strategy.js";

passport.serializeUser((data, done) => {
  done(null, data);
});

passport.deserializeUser((data, done) => {
  done(null, data);
});

export default passport;
