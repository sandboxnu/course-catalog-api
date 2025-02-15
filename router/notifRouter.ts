import express from "express";
import jwt from "jsonwebtoken";
import request from "request-promise-native";
import twilioNotifyer from "./providers/twilio";
import localNotifyer from "./providers/local";
import notificationsManager from "../services/notificationsManager";
import macros from "../utils/macros";

export const router = express.Router();

let notifyer: typeof localNotifyer | typeof twilioNotifyer;
if (process.env.TWILIO_PHONE_NUMBER) {
  notifyer = twilioNotifyer;
} else {
  notifyer = localNotifyer;
}

router.get("/knockknock", (_, res) => res.status(200).send("Who's there?"));

router.post("/twilio/sms", (req, res) => notifyer.handleUserReply(req, res));

router.post("/sms/signup", (req, res) => {
  // twilio needs the phone number in E.164 format see https://www.twilio.com/docs/verify/api/verification
  const phoneNumber = req.body.phoneNumber;
  if (!phoneNumber) {
    res.status(400).send("Missing phone number.");
  }
  notifyer
    .sendVerificationCode(phoneNumber)
    .then((response) => {
      res.status(response.statusCode).send(response.message);
      return;
    })
    .catch(() =>
      res.status(500).send("Error trying to send verification code"),
    );
});

router.post("/sms/verify", (req, res) => {
  const phoneNumber = req.body.phoneNumber;
  const verificationCode = req.body.verificationCode;
  if (!phoneNumber || !verificationCode) {
    return res.status(400).send("Missing phone number or verification code.");
  }

  notifyer
    .checkVerificationCode(phoneNumber, verificationCode)
    .then(async (response) => {
      if (response.statusCode === 200) {
        await notificationsManager.upsertUser(phoneNumber);
        const token = jwt.sign({ phoneNumber }, process.env.JWT_SECRET || "");
        res
          .status(response.statusCode)
          .send({ message: response.message, token });
        return;
      } else {
        res.status(response.statusCode).send(response.message);
        return;
      }
    })
    .catch((e) => {
      macros.error(e);
      res.status(500).send("Error trying to verify code");
    });
});

router.get("/user/subscriptions/:jwt", (req, res) => {
  try {
    const decodedToken = jwt.verify(
      req.params.jwt,
      process.env.JWT_SECRET || "",
    ) as any;
    const phoneNumber = decodedToken.phoneNumber;
    notificationsManager
      .getUserSubscriptions(phoneNumber)
      .then((userSubscriptions) => {
        res.status(200).send(userSubscriptions);
        return;
      })
      .catch((error) => {
        macros.error(error);
        res.status(500).send();
      });
    return;
  } catch (error) {
    res.status(401).send();
  }
});

router.put("/user/subscriptions", (req, res) => {
  const { token, sectionIds, courseIds } = req.body;
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || "") as any;
    const phoneNumber = decodedToken.phoneNumber;
    notificationsManager
      .putUserSubscriptions(phoneNumber, sectionIds, courseIds)
      .then(() => {
        res.status(200).send();
        return;
      })
      .catch((error) => {
        macros.error(error);
        res.status(500).send();
      });
  } catch (error) {
    res.status(401).send();
  }
});

router.delete("/user/subscriptions", (req, res) => {
  const { token, sectionIds, courseIds } = req.body;
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || "") as any;
    const phoneNumber = decodedToken.phoneNumber;
    notificationsManager
      .deleteUserSubscriptions(phoneNumber, sectionIds, courseIds)
      .then(() => {
        res.status(200).send();
        return;
      })
      .catch((error) => {
        macros.error(error);
        res.status(500).send();
      });
  } catch (error) {
    res.status(401).send();
  }
});

router.post("/feedback", async (req, res) => {
  const { message, contact } = req.body;

  const parsed_contact = contact === "" ? "No email provided" : contact;

  const data = {
    text: "Someone submitted some feedback",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Someone submitted some feedback:\n> *Contact*: \`${parsed_contact}\` \n> *Message*: ${message}`,
        },
      },
    ],
  };
  const parsed_data = JSON.stringify(data);

  return await request
    .post({ url: process.env.SLACK_WEBHOOK_URL || "", body: parsed_data })
    .then((_) => res.status(200).send())
    .catch((error) => {
      macros.error(error);

      if (error.response) {
        res.status(error.response.status).send(error.response.statusText);
      } else {
        res.status(500).send();
      }
    });
});
