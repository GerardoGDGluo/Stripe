import 'dotenv/config';
import bodyParser from 'body-parser';
import express from 'express';
import Stripe from 'stripe';
import serviceAccountKey from './serviceAccountKey.js';
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import ejs from 'ejs';
import sendVerificationEmail from './sendEmail.js';

const stripePublishableKey = 'ENVVariable';
const stripeSecretKey = 'ENVariable';

const adminApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
});

const app = express();

app.use((req, res, next) => {
  bodyParser.json()(req, res, next);
});

app.post('/create-payment-intent', async (req, res) => {
  const { email, currency, amount } = req.body;
  console.log(req.body);
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2020-08-27' });

  const customer = await stripe.customers.create({});

  const params = {
    amount: parseInt(amount),
    currency,
    customer: customer.id,
    payment_method_options: {
      card: {
        request_three_d_secure: 'automatic',
      },
    },
    payment_method_types: ['card'],
  };

  try {
    const paymentIntent = await stripe.paymentIntents.create(params);
    return res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    return res.send({ error: error.raw.message });
  }
});

app.post('/payment-sheet', async (req, res) => {
  const { email = 'gerardo@mail.com' } = req.body;

  console.log(email);

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2020-08-27',
    typescript: true,
  });
  try {
    const customers = await stripe.customers.list({
      email,
    });

    let customer;

    if (!customers.data.length) {
      customer = await stripe.customers.create({ email });
    } else {
      customer = customers.data[0];
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2020-08-27' }
    );
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000,
      currency: 'usd',
      customer: customer.id,
      payment_method_types: ['card', 'link'],
    });

    // console.log(customer);
    return res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
    });
  } catch (error) {
    console.log(error);
  }
});

app.post('/payment-sheet-setup-intent', async (req, res) => {
  const { email = 'gerardo@mail.com' } = req.body;

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2020-08-27',
    typescript: true,
  });
  try {
    const customers = await stripe.customers.list({
      email,
    });

    let customer;

    if (!customers.data.length) {
      customer = await stripe.customers.create({ email });
    } else {
      customer = customers.data[0];
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2020-08-27' }
    );
    /*     const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000,
      currency: 'usd',
      customer: customer.id,
      payment_method_types: ['card'],
    }); */

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
    });
    return res.json({
      setupIntent: setupIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
    });
  } catch (error) {
    console.log(error);
  }
});

app.post('/payment-sheet-setup-intent-subscription', async (req, res) => {
  const { email = 'gerardo@mail.com' } = req.body;

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2020-08-27',
    typescript: true,
  });
  try {
    const customers = await stripe.customers.list({
      email,
    });

    let customer;

    if (!customers.data.length) {
      customer = await stripe.customers.create({ email });
    } else {
      customer = customers.data[0];
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2020-08-27' }
    );
    /*     const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000,
      currency: 'usd',
      customer: customer.id,
      payment_method_types: ['card'],
    }); */

    const price = await stripe.prices.create({
      unit_amount: 2000,
      currency: 'mxn',
      recurring: { interval: 'month' },
      product: 'prod_OKDuoqyDPOIU9S',
    });

    console.log('Este es el precio', price);

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      trial_period_days: 7,
    });

    if (typeof subscription.pending_setup_intent === 'string') {
      const setupIntent = await stripe.setupIntents.retrieve(
        subscription.pending_setup_intent
      );

      return res.json({
        setupIntent: setupIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customer.id,
      });
    } else {
      throw new Error('No pending setup intent');
    }
  } catch (error) {
    console.log(error);
  }
});

app.post('/send-custom-verification-email', async (req, res) => {
  const { userEmail, redirectUrl } = req.body;
  const emailValidate = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

  if (!userEmail?.match(emailValidate)) {
    return res.status(401).json({ message: 'Invalid email' });
  } else if (!redirectUrl || typeof redirectUrl !== 'string') {
    return res.status(401).json({ message: 'Invalid redirectUrl' });
  }

  const actionCodeSettings = {
    url: redirectUrl,
  };

  try {
    const actionLink = await getAuth().generateEmailVerificationLink(
      userEmail,
      actionCodeSettings
    );
    const template = await ejs.renderFile('views/verify-email.ejs', {
      actionLink,
      randomNumber: Math.random(),
    });
    await sendVerificationEmail(userEmail, template, actionLink);
    res.status(200).json({ message: 'Email successfully sent' });
  } catch (error) {
    const message = error.message;
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ message });
    }
    if (error.code === 'auth/invalid-continue-uri') {
      return res.status(401).json({ message });
    }
    res.status(500).json({ message });
  }
});

app.listen(3000, () => console.log('Node server listening on port 3000!'));
