import express from "express";
import cors from "cors";
import { createServer } from "http";
import {
  sendVerificationCode,
  checkVerificationCode,
  handleUserReply,
} from "./notifs";

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

app.get("/knockknock", (req, res) => res.send("Who's there?"));

app.post("/twilio/sms", (req, res) => handleUserReply(req, res));

app.post("/sms/signup", (req, res) => {
  // twilio needs the phone number in E.164 format see https://www.twilio.com/docs/verify/api/verification
  const phoneNumber = req.body.phoneNumber;
  if (!phoneNumber) {
    res.status(400).send("Missing phone number.");
  }
  sendVerificationCode(phoneNumber)
    .then((response) => {
      res.status(response.statusCode).send(response.message);
    })
    .catch((e) =>
      res.status(500).send("Error trying to send verification code")
    );
});

app.post("/sms/verify", (req, res) => {
  const phoneNumber = req.body.phoneNumber;
  const verificationCode = req.body.verificationCode;
  if (!phoneNumber || !verificationCode) {
    return res.status(400).send("Missing phone number or verification code.");
  }

  checkVerificationCode(phoneNumber, verificationCode)
    .then((response) => {
      if (typeof response !== "boolean") {
        res.status(response.statusCode).send(response.message);
      } else if (response) {
        console.log("successfully verified!");
        res.status(200).send({ success: true });
      } else {
        console.log("try again");
        res.status(200).send({
          success: false,
          message: "Please try again or request a new verification code.",
        });
      }
    })
    .catch((e) => res.status(500).send("Error trying to verify code"));
});
