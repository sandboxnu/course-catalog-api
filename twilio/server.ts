import express from "express";
import cors from "cors";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import request from "request-promise-native";
import twilioNotifyer from "./notifs";
import notificationsManager from "../services/notificationsManager";
import macros from "../utils/macros";

const corsOptions = {
  origin: process.env.CLIENT_ORIGIN,
};

const app = express();
app.use(cors(corsOptions));
const port = 8080;
app.use(express.json());
const server = createServer(app);

server.listen(port, () => {
  console.log("Running twilio notification server on port %s", port);
});

app.get("/knockknock", (req, res) => res.status(200).send("Who's there?"));

app.post("/twilio/sms", (req, res) => twilioNotifyer.handleUserReply(req, res));

app.post("/sms/signup", (req, res) => {
  // twilio needs the phone number in E.164 format see https://www.twilio.com/docs/verify/api/verification
  const phoneNumber = req.body.phoneNumber;
  if (!phoneNumber) {
    res.status(400).send("Missing phone number.");
  }
  twilioNotifyer
    .sendVerificationCode(phoneNumber)
    .then((response) => {
      res.status(response.statusCode).send(response.message);
      return;
    })
    .catch(() =>
      res.status(500).send("Error trying to send verification code")
    );
});

app.post("/sms/verify", (req, res) => {
  const phoneNumber = req.body.phoneNumber;
  const verificationCode = req.body.verificationCode;
  if (!phoneNumber || !verificationCode) {
    return res.status(400).send("Missing phone number or verification code.");
  }

  twilioNotifyer
    .checkVerificationCode(phoneNumber, verificationCode)
    .then(async (response) => {
      if (response.statusCode === 200) {
        await notificationsManager.upsertUser(phoneNumber);
        const token = jwt.sign({ phoneNumber }, process.env.JWT_SECRET);
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

app.get("/user/subscriptions/:jwt", (req, res) => {
  try {
    const decodedToken = jwt.verify(
      req.params.jwt,
      process.env.JWT_SECRET
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

app.put("/user/subscriptions", (req, res) => {
  const { token, sectionIds, courseIds } = req.body;
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET) as any;
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

app.delete("/user/subscriptions", (req, res) => {
  const { token, sectionIds, courseIds } = req.body;
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET) as any;
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

app.post("/feedback", async (req, res) => {
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
    .post({ url: process.env.SLACK_WEBHOOK_URL, body: parsed_data })
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
