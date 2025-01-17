import graphQlServer from "./gqlServer";
import macros from "../utils/macros";
import notificationServer from "./notifServer";

const port = 8080;
notificationServer.listen(port, () => {
  console.log("Running twilio notification server on port %s", port);
});

graphQlServer
  .listen()
  .then(({ url }) => {
    macros.log(`ready at ${url}`);
    return;
  })
  .catch((err) => {
    macros.error(`error starting graphql server: ${JSON.stringify(err)}`);
  });
