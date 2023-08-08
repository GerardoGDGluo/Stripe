import 'dotenv/config';
const { privateKey } = JSON.parse(process.env.PRIVATE_KEY);

export default {
  project_id: process.env.PROJECT_ID,
  private_key: privateKey,
  client_email: process.env.CLIENT_EMAIL,
};
