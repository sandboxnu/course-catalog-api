import { server as gqlServer } from "./gqlRouter";
import { router as notifRouter } from "./notifRouter";
import cors from "cors";
import { createServer } from "http";
import express from "express";
import { expressMiddleware } from "@apollo/server/express4";

// Why does this have to be wrapped? Under the hood, everything is being converted to CJS
// which does not support top level `await`. IF everything went ESM native, then this could
// be unwrapped

async function createRouter() {
  const app = express();
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN,
    }),
  );
  app.use(express.json());

  app.use(notifRouter);

  await gqlServer.start();
  app.use(expressMiddleware(gqlServer));

  const server = createServer(app);

  const port = 4000;
  server.listen(port, () => {
    // TODO: replace with propper logging call
    console.log("Running router on port %s", port);
  });
}

createRouter();
