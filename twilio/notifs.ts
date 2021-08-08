import twilio from "twilio";
import express from "express";
import macros from "../utils/macros";
import { Socket } from "socket.io";
const MessagingResponse = twilio.twiml.MessagingResponse;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

const MESSAGES = {
  VERIFY:
    "Thanks for signing up for SearchNEU notifications! Please reply VERIFY within 5 minutes to verify your phone number.",
};

const REPLIES = {
  VERIFY: "VERIFY",
  STOP_ALL: "STOP ALL",
};

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export function sendNotificationText(
  recipientNumber: string,
  message: string
): Promise<void> {
  return twilioClient.messages
    .create({ body: message, from: twilioNumber, to: recipientNumber })
    .then(() => {
      macros.log(`Sent notification text to ${recipientNumber}`);
      return;
    })
    .catch((err) => {
      macros.error(
        `Error trying to send notification text to ${recipientNumber}`,
        err
      );
    });
}

export function sendVerificationText(recipientNumber: string): void {
  twilioClient.messages
    .create({
      body: MESSAGES.VERIFY,
      from: twilioNumber,
      to: recipientNumber,
    })
    .then(() => {
      console.log(`Sent verification text to ${recipientNumber}`);
      return;
    })
    .catch((err) => {
      console.log(
        `Error trying to send verification text to ${recipientNumber}`
      );
      console.log(err);
    });
}

export function handleUserReply(
  req: express.Request,
  res: express.Response,
  phoneNumberToSocket: Map<string, Socket>
): void {
  const message = req.body.Body;
  const senderNumber = req.body.From;

  console.log(`Received a text from ${senderNumber}: ${message}`);

  const twimlResponse = new MessagingResponse();

  switch (message) {
    case REPLIES.VERIFY:
      if (phoneNumberToSocket.has(senderNumber.substring(2))) {
        twimlResponse.message("Found phone number in map");
      } else {
        twimlResponse.message("Couldn't find phone number in map");
      }
      break;
    case REPLIES.STOP_ALL:
      twimlResponse.message("cya");
      break;
    default:
      twimlResponse.message("SearchNEU Bot failed to understand your message");
  }
  res.send(twimlResponse.toString());
}
