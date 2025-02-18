import { server as gqlServer } from "./gqlRouter";
import { router as notifRouter } from "./notifRouter";
import cors from "cors";
import { createServer } from "http";
import express from "express";
import { expressMiddleware } from "@apollo/server/express4";

// Why does this have to be wrapped? Under the hood, everything is being converted to CJS
// which does not support top level `await`. IF everything went ESM native, then this could
// be unwrapped
//
// TODO: Get rid of the dedicated notification endpoint / server. Rn both the gql and notif endpoints
// are being served from the previously only gql endpoint AND notifs are being run on their original port.

async function createRouter() {
  const app = express();
  const notifApp = express();
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN,
    }),
  );
  app.use(express.json());
  notifApp.use(express.json());

  app.use(notifRouter);
  notifApp.use(notifRouter);

  await gqlServer.start();
  app.use(expressMiddleware(gqlServer));

  const server = createServer(app);
  const notifServer = createServer(notifApp);

  const port = 4000;
  server.listen(port, () => {
    // TODO: replace with propper logging call
    console.log("Running router on port %s", port);
  });

  notifServer.listen(8080, () => {
    console.log("Running notifs on port 8080");
  });
}

createRouter();
