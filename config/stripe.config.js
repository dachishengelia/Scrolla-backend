const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

console.log('Stripe configuration loaded. STRIPE_SECRET_KEY present:', !!process.env.STRIPE_SECRET_KEY);

module.exports = stripe;