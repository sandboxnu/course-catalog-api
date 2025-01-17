import { TwilioResponse } from "./notifs";
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
    // Any code will always be accepted but a randomly generated verification code
    // is printed to the terminal because it makes people feel good
    const verificationCode = "" + Math.floor(Math.random() * 1000000);
    console.log("Verification Code: " + verificationCode.padStart(6, "0"));
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
