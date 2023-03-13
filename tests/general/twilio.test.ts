import { twilioClient } from "../../twilio/client.js";
jest.mock("../../twilio/client", () => ({
  twilioClient: jest.fn(),
}));

import notifs from "../../twilio/notifs.js";
import express from "express";
import macros from "../../utils/macros.js";
import notificationsManager from "../../services/notificationsManager.js";

describe("TwilioNotifyer", () => {
  describe("checkVerificationCode", () => {
    beforeAll(() => {
      twilioClient["verify"] = {
        // @ts-expect-error - wrong type
        services: () => {
          return {
            verificationChecks: {
              create: jest.fn(async (args) => {
                switch (args.code) {
                  case "VERIFIED":
                    return { status: notifs.TWILIO_VERIF_CHECK_APPROVED };
                  case "NOT VERIFIED":
                    return { status: "any status besides that one above" };
                  default: {
                    const err = new Error();
                    // @ts-expect-error - Wrong type, I don't care :)
                    err.code = args.code;
                    throw err;
                  }
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
      const resp_max_attempts = await notifs.checkVerificationCode(
        "911",
        // @ts-expect-error - wrong type, don't care
        notifs.TWILIO_ERRORS.MAX_CHECK_ATTEMPTS_REACHED
      );
      const resp_not_found = await notifs.checkVerificationCode(
        "911",
        // @ts-expect-error - wrong type, don't care
        notifs.TWILIO_ERRORS.RESOURCE_NOT_FOUND
      );
      const resp_invalid = await notifs.checkVerificationCode(
        "911",
        // @ts-expect-error - wrong type, don't care
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

  describe("sendVerificationCode", () => {
    beforeAll(() => {
      twilioClient["verify"] = {
        // @ts-expect-error - wrong type
        services: () => {
          return {
            verifications: {
              create: jest.fn(async (args) => {
                const err = new Error();
                switch (args.to) {
                  case "1":
                    return 200;
                  case "2":
                    // @ts-expect-error -- wrong error type
                    err.code = notifs.TWILIO_ERRORS.SMS_NOT_FOR_LANDLINE;
                    throw err;
                  case "3":
                    // @ts-expect-error -- wrong error type
                    err.code = notifs.TWILIO_ERRORS.INVALID_PHONE_NUMBER;
                    throw err;
                  case "4":
                    // @ts-expect-error -- wrong error type
                    err.code = notifs.TWILIO_ERRORS.MAX_SEND_ATTEMPTS_REACHED;
                    throw err;
                  default:
                    throw err;
                }
              }),
            },
          };
        },
      };
    });

    it("non-error", async () => {
      const resp = await notifs.sendVerificationCode("1");
      expect(resp.statusCode).toBe(200);
      expect(resp.message).toMatch(/code sent/i);
    });

    it("landline error", async () => {
      const resp = await notifs.sendVerificationCode("2");
      expect(resp.statusCode).toBe(400);
      expect(resp.message).toMatch(/not supported by landline/i);
    });

    it("invalid number error", async () => {
      const resp = await notifs.sendVerificationCode("3");
      expect(resp.statusCode).toBe(400);
      expect(resp.message).toMatch(/invalid phone number/i);
    });

    it("max send attempts error", async () => {
      const resp = await notifs.sendVerificationCode("4");
      expect(resp.statusCode).toBe(400);
      expect(resp.message).toMatch(/attempted to send.*too many times/i);
    });

    it("default error", async () => {
      await expect(notifs.sendVerificationCode("123123142")).rejects.toThrow();
    });
  });

  describe("sendNotificationText", () => {
    beforeAll(() => {
      twilioClient["messages"] = {
        // @ts-expect-error - wrong type
        create: jest.fn(async (args) => {
          const err = new Error();
          switch (args.to) {
            case "1":
              return;
            case "2":
              // @ts-expect-error -- wrong error type
              err.code = notifs.TWILIO_ERRORS.USER_UNSUBSCRIBED;
              throw err;
            default:
              throw err;
          }
        }),
      };
    });

    it("Successfully sends a message", async () => {
      jest.spyOn(macros, "log");
      await notifs.sendNotificationText("1", "message");
      expect(macros.log).toHaveBeenCalledWith(
        expect.stringMatching(/sent.*text/i)
      );
    });

    it("Unsubcribed error", async () => {
      jest.spyOn(macros, "warn");
      jest
        .spyOn(notificationsManager, "deleteAllUserSubscriptions")
        .mockImplementationOnce(async () => {
          // don't do anytthing
        });

      await notifs.sendNotificationText("2", "message");
      expect(macros.warn).toHaveBeenCalledWith(
        expect.stringMatching(/has unsubscribed/i)
      );
      expect(
        notificationsManager.deleteAllUserSubscriptions
      ).toHaveBeenCalledWith("2");
    });

    it("Default error", async () => {
      jest.spyOn(macros, "error").mockImplementationOnce(() => {
        // don't do anytthing
      });

      await notifs.sendNotificationText("3", "message");
      expect(macros.error).toHaveBeenCalledWith(
        expect.stringMatching(/error trying to send/i),
        expect.any(Error)
      );
    });
  });
});
