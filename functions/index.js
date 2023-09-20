/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
import * as functions from 'firebase-functions';

import 'dotenv/config';
import bodyParser from 'body-parser';
import express from 'express';
import Stripe from 'stripe';
import serviceAccountKey from './serviceAccountKey.js';
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import ejs from 'ejs';
import sendVerificationEmail from './sendEmail.js';

// const stripeSecretKey = functions.config().someservice.stripesecret;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const adminApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
});

function sumValues(obj) {
  let sum = 0;
  for (const key in obj) {
    const value = Number(obj[key]);
    sum += value;
  }
  return sum;
}

function splitObject(original) {
  const datosFacturacion = [
    'cfdi',
    'cp',
    'razon',
    'regimen',
    'rfc',
    'tipoDeEntidad',
  ];
  const facturacion = {};
  const amounts = {};

  for (const prop of datosFacturacion) {
    if (original[prop] !== undefined) {
      facturacion[prop] = original[prop];
    }
  }

  for (const key in original) {
    if (
      original.hasOwnProperty(key) &&
      !datosFacturacion.includes(key) &&
      original[key] !== undefined
    ) {
      amounts[key] = original[key];
    }
  }

  return [facturacion, amounts];
}

const app = express();

app.use((req, res, next) => {
  bodyParser.json()(req, res, next);
});

app.get('/hola', (req, res) => {
  res.send('Hello World');
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
  const {
    email = 'gerardo@mail.com',
    amount = 250,
    withFacturacion = true,
    values = {},
  } = req.body;

  console.log({ email, amount, withFacturacion, values });

  const [facturacion, amounts] = splitObject(values);
  const total = sumValues(amounts);

  console.log({ facturacion, amounts, total });

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
      amount: amount * 100,
      currency: 'mxn',
      customer: customer.id,
      payment_method_types: ['card'],
    });

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

export const stirpePayment = functions.https.onRequest(app);
