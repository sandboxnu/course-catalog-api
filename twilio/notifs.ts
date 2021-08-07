import twilio from "twilio";
import express from "express";
const MessagingResponse = twilio.twiml.MessagingResponse;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const serviceId = process.env.TWILIO_VERIFY_SERVICE_ID;

const REPLIES = {
  STOP_ALL: "STOP ALL",
};

const TWILIO_ERROR = {
  SMS_NOT_FOR_LANDLINE: 60205,
  INVALID_PHONE_NUMBER: 60200,
  MAX_CHECK_ATTEMPTS_REACHED: 60202,
  MAX_SEND_ATTEMPTS_REACHED: 60203,
  RESOURCE_NOT_FOUND: 20404,
};

const TWILIO_VERIF_CHECK_APPROVED = "approved";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export interface TwilioResponse {
  statusCode: number;
  message: string;
}

export function sendVerificationCode(
  recipientNumber: string
): Promise<TwilioResponse> {
  return twilioClient.verify
    .services(serviceId)
    .verifications.create({ to: recipientNumber, channel: "sms" })
    .then((verification) => {
      return { statusCode: 200, message: "Verification code sent!" };
    })
    .catch((err) => {
      switch (err.code) {
        case TWILIO_ERROR.SMS_NOT_FOR_LANDLINE:
          return {
            statusCode: 400,
            message: "SMS is not supported by landline phone number",
          };
        case TWILIO_ERROR.INVALID_PHONE_NUMBER:
          return {
            statusCode: 400,
            message:
              "Invalid phone number. Please make sure the phone number follows the E.164 format.",
          };
        case TWILIO_ERROR.MAX_SEND_ATTEMPTS_REACHED:
          return {
            statusCode: 400,
            message:
              "You've attempted to send the verification code too many times. Either verify your code or wait 10 minutes for the verification code to expire.",
          };
        default:
          console.error(
            `Error trying to send verification code to ${recipientNumber}`,
            err
          );
          throw err;
      }
    });
}

export function checkVerificationCode(
  recipientNumber: string,
  code: string
): Promise<boolean | TwilioResponse> {
  return twilioClient.verify
    .services(serviceId)
    .verificationChecks.create({ to: recipientNumber, code: code })
    .then((verification_check) => {
      return verification_check.status === TWILIO_VERIF_CHECK_APPROVED;
    })
    .catch((err) => {
      switch (err.code) {
        case TWILIO_ERROR.MAX_CHECK_ATTEMPTS_REACHED:
          return {
            statusCode: 400,
            message:
              "You've attempted to check the verification code too many times. Either wait 10 minutes for the current verification to expire or request a new verification code.",
          };
        case TWILIO_ERROR.RESOURCE_NOT_FOUND:
          console.warn(
            `Error: ${err.code}\nVerification code doesn't exist, expired (10 minutes) or has already been approved.`
          );
          return false;
        case TWILIO_ERROR.INVALID_PHONE_NUMBER:
          return {
            statusCode: 400,
            message:
              "Invalid phone number. Please make sure the phone number follows the E.164 format.",
          };
        default:
          console.error(
            `Error trying to validate verification code from ${recipientNumber}`,
            err
          );
          throw err;
      }
    });
}

export function handleUserReply(
  req: express.Request,
  res: express.Response
): void {
  const message = req.body.Body;
  const senderNumber = req.body.From;

  console.log(`Received a text from ${senderNumber}: ${message}`);

  const twimlResponse = new MessagingResponse();

  switch (message) {
    case REPLIES.STOP_ALL:
      twimlResponse.message(
        "You have been removed from all SearchNEU notifications."
      );
      break;
    default:
      twimlResponse.message("SearchNEU Bot failed to understand your message");
  }
  res.send(twimlResponse.toString());
}
