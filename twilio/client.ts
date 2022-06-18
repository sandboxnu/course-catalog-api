import twilio from "twilio";

/* Don't merge this with the `./notifs.ts` file

Keeing this separate allows us to easily mock the Twilio client for tests */
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export { twilioClient };
