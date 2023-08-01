import bodyParser from 'body-parser';
import express from 'express';
import Stripe from 'stripe';

const stripePublishableKey =
  'pk_test_51NTFUuBRRUJORUqEnIFo2g4995iyR7fjulKjqrb37xnH5d7XmjmPB0m5MpbyfiK9oXZHc9eL6obRSz0hyfQW7tQF00hgajqNNB';
const stripeSecretKey =
  'sk_test_51NTFUuBRRUJORUqEVInQYdhMWUWSUFZAoIkms1XQYDJunbBK70YRz2i0yal8LjKIq4RY8l1kzEZpD7BL6mbAaRyi00g0yxYj9c';

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

app.listen(3000, () => console.log('Node server listening on port 3000!'));
