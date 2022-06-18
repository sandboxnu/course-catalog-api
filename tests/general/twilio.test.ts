import { twilioClient } from "../../twilio/client";
jest.mock("../../twilio/client", () => ({
  twilioClient: jest.fn(),
}));

import notifs from "../../twilio/notifs";
import express from "express";

describe("TwilioNotifyer", () => {
  describe("checkVerificationCode", () => {
    beforeAll(() => {
      twilioClient["verify"] = {
        // @ts-expect-error - wrong type
        services: (_sid) => {
          return {
            verificationChecks: {
              create: jest.fn(async (args) => {
                switch (args.code) {
                  case "VERIFIED":
                    return { status: notifs.TWILIO_VERIF_CHECK_APPROVED };
                  case "NOT VERIFIED":
                    return { status: "any status besides that one above" };
                  default:
                    const err = new Error();
                    // @ts-expect-error - Wrong type, I don't care :)
                    err.code = args.code;
                    throw err;
                }
              }),
            },
          };
        },
      };
    });

    it("Non-error responses", async () => {
      expect(
        (await notifs.checkVerificationCode("911", "VERIFIED")).statusCode
      ).toBe(200);
      const resp2 = await notifs.checkVerificationCode("911", "NOT VERIFIED");
      expect(resp2.statusCode).toBe(400);
      expect(resp2.message).toMatch(/please try again/i);
    });

    it("Error responses", async () => {
      // @ts-expect-error
      const resp_max_attempts = await notifs.checkVerificationCode(
        "911",
        notifs.TWILIO_ERRORS.MAX_CHECK_ATTEMPTS_REACHED
      );
      // @ts-expect-error
      const resp_not_found = await notifs.checkVerificationCode(
        "911",
        notifs.TWILIO_ERRORS.RESOURCE_NOT_FOUND
      );
      // @ts-expect-error
      const resp_invalid = await notifs.checkVerificationCode(
        "911",
        notifs.TWILIO_ERRORS.INVALID_PHONE_NUMBER
      );

      expect(resp_max_attempts.statusCode).toBe(400);
      expect(resp_max_attempts.message).toMatch(/too many times/);

      expect(resp_not_found.statusCode).toBe(400);
      expect(resp_not_found.message).toMatch(/try again/i);

      expect(resp_invalid.statusCode).toBe(400);
      expect(resp_invalid.message).toMatch(/invalid phone number/i);

      await expect(
        notifs.checkVerificationCode("911", "random error")
      ).rejects.toThrow();
    });
  });

  describe("handleUserReply", () => {
    const mockRes = {
      send: jest.fn(),
    };

    afterEach(() => {
      mockRes.send.mockClear();
    });

    it("should handle unknown user replies", () => {
      const req: Partial<express.Request> = {
        body: {
          Body: "this is a fake message that means nothing",
          From: "911",
        },
      };

      // @ts-expect-error - it's not the exact same type, but I don't care
      notifs.handleUserReply(req, mockRes);
      expect(mockRes.send.mock.calls[0][0]).toMatch(
        /failed to understand your message/i
      );
    });

    it("should handle a 'Stop all' request", () => {
      const req: Partial<express.Request> = {
        body: {
          Body: notifs.TWILIO_REPLIES["STOP_ALL"],
          From: "911",
        },
      };

      // @ts-expect-error - it's not the exact same type, but I don't care
      notifs.handleUserReply(req, mockRes);
      expect(mockRes.send.mock.calls[0][0]).toMatch(/have been removed/i);
    });
  });
});
