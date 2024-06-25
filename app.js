require("dotenv").config({ silent: true });

const express = require("express");
const cookieParser = require("cookie-parser");
const middleware = require("./middleware/index.js");
const port = process.env.PORT || 3000;

const app = express();
app.use(cookieParser());

app.get("/", (_req, res) => {
	res.status(404).send();
});

app.get("/auth", middleware.auth);
app.get("/callback", middleware.callback);

app.listen(port);
