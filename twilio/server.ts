import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { sendVerificationText, handleUserReply } from "./notifs";

const app = express();
const port = 8080;
app.use(express.urlencoded({ extended: false }));
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

server.listen(port, () => {
  console.log("Running twilio notification server on port %s", port);
});

app.get("/knockknock", (req, res) => res.send("Who's there?"));

const phoneNumberToSocket = new Map<string, Socket>();

app.post("/twilio/sms", (req, res) =>
  handleUserReply(req, res, phoneNumberToSocket)
);

io.on("connect", (socket) => {
  console.log("New client connected");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    for (const p of phoneNumberToSocket.keys()) {
      if (phoneNumberToSocket.get(p).id === socket.id) {
        phoneNumberToSocket.delete(p);
        console.log(`Disconnected ${p}`);
      }
    }
  });

  socket.on("phone", (phoneNumber) => {
    phoneNumberToSocket.set(phoneNumber, socket);
    sendVerificationText(phoneNumber);
  });
});
