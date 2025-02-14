import { server as gqlServer } from "./gqlRouter.ts";
import { router as notifRouter } from "./notifRouter.ts";
import cors from "cors";
import { createServer } from "http";
import express from "express";
import { expressMiddleware } from "@apollo/server/express4";

const corsOptions = {
  origin: process.env.CLIENT_ORIGIN,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

app.use(notifRouter);

await gqlServer.start();
app.use(expressMiddleware(gqlServer));

const server = createServer(app);

const port = 4000;
server.listen(port, () => {
  console.log("Running router on port %s", port);
});
