require("dotenv").config({ silent: true });

const express = require("express");
const middleware = require("./middleware/index.js");
const port = process.env.PORT || 3000;

const app = express();

app.get("/auth", middleware.auth);
app.get("/callback", middleware.callback);
app.get("/success", middleware.success);
app.get("/", middleware.index);

app.listen(port, () => {
  console.log(`IDRC CMS Authenticator listening on port ${port}.`);
});
