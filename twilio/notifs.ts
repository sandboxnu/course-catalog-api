import twilio, { Twilio } from "twilio";
import express from "express";
import macros from "../utils/macros";
import notificationsManager from "../services/notificationsManager";
import { twilioClient } from "./client";

const MessagingResponse = twilio.twiml.MessagingResponse;

export interface TwilioResponse {
  statusCode: number;
  message: string;
}

class TwilioNotifyer {
  TWILIO_NUMBER: string;
  TWILIO_VERIFY_SERVICE_SID: string;
  TWILIO_REPLIES: Record<string, string>;
  TWILIO_ERRORS: Record<string, number>;
  TWILIO_VERIF_CHECK_APPROVED: string;
  twilioClient: Twilio;

  constructor() {
    this.TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER;
    this.TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_ID;
    this.TWILIO_REPLIES = {
      STOP_ALL: "STOP ALL",
    };
    this.TWILIO_ERRORS = {
      SMS_NOT_FOR_LANDLINE: 60205,
      INVALID_PHONE_NUMBER: 60200,
      MAX_CHECK_ATTEMPTS_REACHED: 60202,
      MAX_SEND_ATTEMPTS_REACHED: 60203,
      RESOURCE_NOT_FOUND: 20404,
      USER_UNSUBSCRIBED: 21610,
    };
    this.TWILIO_VERIF_CHECK_APPROVED = "approved";
    this.twilioClient = twilioClient;
  }

  async sendNotificationText(
    recipientNumber: string,
    message: string,
  ): Promise<void> {
    return this.twilioClient.messages
      .create({ body: message, from: this.TWILIO_NUMBER, to: recipientNumber })
      .then(() => {
        macros.log(`Sent notification text to ${recipientNumber}`);
        return;
      })
      .catch(async (err) => {
        switch (err.code) {
          case this.TWILIO_ERRORS.USER_UNSUBSCRIBED:
            macros.warn(
              `${recipientNumber} has unsubscribed from notifications`,
            );
            await notificationsManager.deleteAllUserSubscriptions(
              recipientNumber,
            );
            return;
          default:
            macros.error(
              `Error trying to send notification text to ${recipientNumber}`,
              err,
            );
        }
      });
  }

  async sendVerificationCode(recipientNumber: string): Promise<TwilioResponse> {
    return this.twilioClient.verify.v2
      .services(this.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to: recipientNumber, channel: "sms" })
      .then(() => {
        return { statusCode: 200, message: "Verification code sent!" };
      })
      .catch((err) => {
        switch (err.code) {
          case this.TWILIO_ERRORS.SMS_NOT_FOR_LANDLINE:
            return {
              statusCode: 400,
              message: "SMS is not supported by landline phone number",
            };
          case this.TWILIO_ERRORS.INVALID_PHONE_NUMBER:
            return {
              statusCode: 400,
              message:
                "Invalid phone number. Please make sure the phone number follows the E.164 format.",
            };
          case this.TWILIO_ERRORS.MAX_SEND_ATTEMPTS_REACHED:
            return {
              statusCode: 400,
              message:
                "You've attempted to send the verification code too many times. Either verify your code or wait 10 minutes for the verification code to expire.",
            };
          default:
            macros.error(
              `Error trying to send verification code to ${recipientNumber}`,
              err,
            );
            throw err;
        }
      });
  }

  async checkVerificationCode(
    recipientNumber: string,
    code: string,
  ): Promise<TwilioResponse> {
    return this.twilioClient.verify.v2
      .services(this.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: recipientNumber, code: code })
      .then((verification_check) => {
        if (verification_check.status === this.TWILIO_VERIF_CHECK_APPROVED) {
          return { statusCode: 200, message: "Successfully verified!" };
        } else {
          return {
            statusCode: 400,
            message: "Please try again or request a new verification code.",
          };
        }
      })
      .catch((err) => {
        switch (err.code) {
          case this.TWILIO_ERRORS.MAX_CHECK_ATTEMPTS_REACHED:
            return {
              statusCode: 400,
              message:
                "You've attempted to check the verification code too many times. Either wait 10 minutes for the current verification to expire or request a new verification code.",
            };
          case this.TWILIO_ERRORS.RESOURCE_NOT_FOUND:
            macros.warn(
              `Error: ${err.code}\nVerification code doesn't exist, expired (10 minutes) or has already been approved.`,
            );
            return {
              statusCode: 400,
              message: "Please try again or request a new verification code.",
            };
          case this.TWILIO_ERRORS.INVALID_PHONE_NUMBER:
            return {
              statusCode: 400,
              message:
                "Invalid phone number. Please make sure the phone number follows the E.164 format.",
            };
          default:
            macros.error(
              `Error trying to validate verification code from ${recipientNumber}`,
              err,
            );
            throw err;
        }
      });
  }

  handleUserReply(req: express.Request, res: express.Response): void {
    const message = req.body.Body;
    const senderNumber = req.body.From;

    macros.log(`Received a text from ${senderNumber}: ${message}`);

    const twimlResponse = new MessagingResponse();

    switch (message) {
      // TODO: actually remove user from SearchNEU notifs
      case this.TWILIO_REPLIES.STOP_ALL:
        twimlResponse.message(
          "You have been removed from all SearchNEU notifications.",
        );
        notificationsManager.deleteAllUserSubscriptions(senderNumber);
        break;
      default:
        twimlResponse.message(
          "SearchNEU Bot failed to understand your message",
        );
    }
    res.send(twimlResponse.toString());
  }
}

const instance = new TwilioNotifyer();
export default instance;
