import {
  suite,
  test,
  mock,
  before,
  after,
  afterEach,
  type TestContext,
} from "node:test";

// Import the modules
import { twilioClient } from "$/router/providers/twilioClient";
import notifs from "$/router/providers/twilio";
import macros from "../../utils/macros";
import notificationsManager from "../../services/notificationsManager";

suite("TwilioNotifyer", () => {
  suite("checkVerificationCode", () => {
    before(() => {
      mock.method(twilioClient.verify.v2.services, "get", () => ({
        verificationChecks: {
          create: async (args: { num: string; code: string }) => {
            switch (args.code) {
              case "VERIFIED":
                return { status: notifs.TWILIO_VERIF_CHECK_APPROVED };
              case "NOT VERIFIED":
                return { status: "any status besides that one above" };
              default: {
                const err = new Error();
                // @ts-expect-error - Wrong type don't care
                err.code = args.code;
                throw err;
              }
            }
          },
        },
      }));
    });

    after(() => {
      mock.reset();
    });

    test("Non-error responses", async (t: TestContext) => {
      const verifiedResponse = await notifs.checkVerificationCode(
        "911",
        "VERIFIED",
      );
      t.assert.strictEqual(verifiedResponse.statusCode, 200);

      const notVerifiedResponse = await notifs.checkVerificationCode(
        "911",
        "NOT VERIFIED",
      );
      t.assert.strictEqual(notVerifiedResponse.statusCode, 400);
      t.assert.match(notVerifiedResponse.message, /please try again/i);
    });

    test("Error responses", async (t: TestContext) => {
      // Make the logs go away
      t.mock.method(macros, "warn", () => {});
      t.mock.method(macros, "error", () => {});

      const resp_max_attempts = await notifs.checkVerificationCode(
        "911",
        // @ts-ignore - BUG: This needs to get fixed - these must be numbers but the func wants strings
        notifs.TWILIO_ERRORS.MAX_CHECK_ATTEMPTS_REACHED,
      );
      const resp_not_found = await notifs.checkVerificationCode(
        "911",
        // @ts-ignore - BUG: This needs to get fixed - these must be numbers but the func wants strings
        notifs.TWILIO_ERRORS.RESOURCE_NOT_FOUND,
      );
      const resp_invalid = await notifs.checkVerificationCode(
        "911",
        // @ts-ignore - BUG: This needs to get fixed - these must be numbers but the func wants strings
        notifs.TWILIO_ERRORS.INVALID_PHONE_NUMBER,
      );

      t.assert.strictEqual(resp_max_attempts.statusCode, 400);
      t.assert.match(resp_max_attempts.message, /too many times/);

      t.assert.strictEqual(resp_not_found.statusCode, 400);
      t.assert.match(resp_not_found.message, /try again/i);

      t.assert.strictEqual(resp_invalid.statusCode, 400);
      t.assert.match(resp_invalid.message, /invalid phone number/i);

      await t.assert.rejects(
        notifs.checkVerificationCode("911", "random error"),
      );
    });
  });

  suite("handleUserReply", () => {
    const mockRes = {
      send: mock.fn(),
    };

    afterEach(() => {
      mockRes.send.mock.resetCalls();
    });

    test("should handle unknown user replies", async (t: TestContext) => {
      const req = {
        body: {
          Body: "this is a fake message that means nothing",
          From: "911",
        },
      };

      // @ts-ignore Not gonna build a whole request
      await notifs.handleUserReply(req, mockRes);
      t.assert.match(
        mockRes.send.mock.calls[0].arguments[0],
        /failed to understand your message/i,
      );
    });
    test("should handle a 'Stop all' request", async (t: TestContext) => {
      const req = {
        body: {
          Body: notifs.TWILIO_REPLIES["STOP_ALL"],
          From: "911",
        },
      };

      const deleteSpy = t.mock.method(
        notificationsManager,
        "deleteAllUserSubscriptions",
        async () => undefined,
      );

      // @ts-ignore Not gonna build a whole request
      await notifs.handleUserReply(req, mockRes);

      t.assert.strictEqual(deleteSpy.mock.calls[0].arguments[0], "911");
      t.assert.match(
        mockRes.send.mock.calls[0].arguments[0],
        /have been removed/i,
      );
    });
  });

  suite("sendVerificationCode", () => {
    before(() => {
      mock.method(twilioClient.verify.v2.services, "get", () => ({
        verifications: {
          create: async (args: any) => {
            const err = new Error();
            switch (args.to) {
              case "1":
                return 200;
              case "2":
                // @ts-ignore Really this should get fixed
                err.code = notifs.TWILIO_ERRORS.SMS_NOT_FOR_LANDLINE;
                throw err;
              case "3":
                // @ts-ignore Really this should get fixed
                err.code = notifs.TWILIO_ERRORS.INVALID_PHONE_NUMBER;
                throw err;
              case "4":
                // @ts-ignore Really this should get fixed
                err.code = notifs.TWILIO_ERRORS.MAX_SEND_ATTEMPTS_REACHED;
                throw err;
              default:
                throw err;
            }
          },
        },
      }));
    });

    test("non-error", async (t: TestContext) => {
      const resp = await notifs.sendVerificationCode("1");
      t.assert.strictEqual(resp.statusCode, 200);
      t.assert.match(resp.message, /code sent/i);
    });

    test("landline error", async (t: TestContext) => {
      const resp = await notifs.sendVerificationCode("2");
      t.assert.strictEqual(resp.statusCode, 400);
      t.assert.match(resp.message, /not supported by landline/i);
    });

    test("invalid number error", async (t: TestContext) => {
      const resp = await notifs.sendVerificationCode("3");
      t.assert.strictEqual(resp.statusCode, 400);
      t.assert.match(resp.message, /invalid phone number/i);
    });

    test("max send attempts error", async (t: TestContext) => {
      const resp = await notifs.sendVerificationCode("4");
      t.assert.strictEqual(resp.statusCode, 400);
      t.assert.match(resp.message, /attempted to send.*too many times/i);
    });

    test("default error", async (t: TestContext) => {
      // Make the logs go away
      t.mock.method(macros, "error", () => {});
      await t.assert.rejects(
        async () => await notifs.sendVerificationCode("123123142"),
      );
    });
  });

  suite("sendNotificationText", () => {
    before(() => {
      mock.method(twilioClient.messages, "create", async (args: any) => {
        const err = new Error();
        switch (args.to) {
          case "1":
            return;
          case "2":
            // @ts-expect-error -- keeping original comment
            err.code = notifs.TWILIO_ERRORS.USER_UNSUBSCRIBED;
            throw err;
          default:
            throw err;
        }
      });
    });

    // BUG: This is the shittiest way to test this. Truly terrible
    // Will reinstate the test after it gets fixed!!
    test(
      "Successfully sends a message",
      { skip: true },
      async (t: TestContext) => {
        const logSpy = t.mock.method(macros, "log");

        await notifs.sendNotificationText("1", "message");

        t.assert.strictEqual(logSpy.mock.callCount(), 1);
        t.assert.match(logSpy.mock.calls[0].arguments[0], /sent.*text/i);
      },
    );

    test("Unsubcribed error", async (t: TestContext) => {
      const warnSpy = t.mock.method(macros, "warn", () => {});

      const deleteAllSpy = t.mock.method(
        notificationsManager,
        "deleteAllUserSubscriptions",
        async () => {},
      );

      await notifs.sendNotificationText("2", "message");

      t.assert.strictEqual(warnSpy.mock.callCount(), 1);
      t.assert.match(warnSpy.mock.calls[0].arguments[0], /has unsubscribed/i);

      t.assert.strictEqual(deleteAllSpy.mock.callCount(), 1);
      t.assert.strictEqual(deleteAllSpy.mock.calls[0].arguments[0], "2");
    });

    test("Default error", async (t: TestContext) => {
      const errorSpy = t.mock.method(macros, "error", () => {});

      await notifs.sendNotificationText("3", "message");

      t.assert.strictEqual(errorSpy.mock.callCount(), 1);
      t.assert.match(
        errorSpy.mock.calls[0].arguments[0],
        /error trying to send/i,
      );
      t.assert.ok(errorSpy.mock.calls[0].arguments[1] instanceof Error);
    });
  });
});
