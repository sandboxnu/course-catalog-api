import { TwilioResponse } from "./twilio.ts";
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";

class LocalNotifyer {
  async sendNotificationText(
    recipientNumber: string,
    message: string,
  ): Promise<void> {
    console.log(`Message for ${recipientNumber}\nMessage: ${message}`);
  }

  async sendVerificationCode(recipientNumber: string): Promise<TwilioResponse> {
    return { statusCode: 200, message: "Verification code sent!" };
  }

  async checkVerificationCode(
    recipientNumber: string,
    code: string,
  ): Promise<TwilioResponse> {
    return { statusCode: 200, message: "Successfully verified!" };
  }

  handleUserReply(req: ExpressRequest, res: ExpressResponse): void {}
}

const instance = new LocalNotifyer();
export default instance;
