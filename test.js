require("dotenv").config({ path: ".env.test", silent: true });

const test = require("ava");
const request = require("supertest");
const express = require("express");
const process = require("node:process");
const cookieParser = require("cookie-parser");
const middleware = require("./middleware/index.js");

test.serial(
  "GitHub auth route succeeds with valid provider and site id",
  async (t) => {
    const app = express();

    app.use(cookieParser());

    app.get("/auth", middleware.auth);

    const res = await request(app)
      .get("/auth?provider=github&site_id=example.com")
      .send();

    t.is(res.redirect, true);
    t.regex(
      res.header.location,
      /https:\/\/github.com\/login\/oauth\/authorize\?client_id=client-id&scope=repo%2Cuser&state=[a-zA-Z0-9_-]+/,
    );
  },
);

test.serial(
  "GitLab auth route succeeds with valid provider and site id",
  async (t) => {
    process.env.GIT_HOSTNAME = "gitlab.com";
    const app = express();

    app.use(cookieParser());

    app.get("/auth", middleware.auth);

    const res = await request(app)
      .get("/auth?provider=gitlab&site_id=example.com")
      .send();

    t.is(res.redirect, true);
    t.regex(
      res.header.location,
      /https:\/\/gitlab.com\/oauth\/authorize\?client_id=client-id&redirect_uri=http\%3A\%2F\%2F127\.0\.0\.1\%2Fcallback&response_type=code&scope=api&state=[a-zA-Z0-9_-]+/,
    );
    t.teardown(() => {
      process.env.GIT_HOSTNAME = "github.com";
    });
  },
);

test("auth route fails without valid provider", async (t) => {
  const app = express();

  app.use(cookieParser());

  app.get("/auth", middleware.auth);

  const res = await request(app)
    .get("/auth?provider=forgejo&site_id=example.com")
    .send();

  t.is(res.redirect, false);
  t.regex(res.text, /UNSUPPORTED_BACKEND/);
});

test("auth route fails without valid domain", async (t) => {
  const app = express();

  app.use(cookieParser());

  app.get("/auth", middleware.auth);

  const res = await request(app)
    .get("/auth?provider=github&site_id=example.test")
    .send();
  t.is(res.redirect, false);
  t.regex(res.text, /UNSUPPORTED_DOMAIN/);
});

test("auth route fails without client ID", async (t) => {
  const clientId = process.env.OAUTH_CLIENT_ID;
  process.env.OAUTH_CLIENT_ID = "";

  const app = express();

  app.use(cookieParser());

  app.get("/auth", middleware.auth);

  const res = await request(app)
    .get("/auth?provider=github&site_id=example.com")
    .send();
  t.is(res.redirect, false);
  t.regex(res.text, /MISCONFIGURED_CLIENT/);
  t.teardown(() => {
    process.env.OAUTH_CLIENT_ID = clientId;
  });
});

test("auth route fails without client secret", async (t) => {
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  process.env.OAUTH_CLIENT_SECRET = "";

  const app = express();

  app.use(cookieParser());

  app.get("/auth", middleware.auth);

  const res = await request(app)
    .get("/auth?provider=github&site_id=example.com")
    .send();
  t.is(res.redirect, false);
  t.regex(res.text, /MISCONFIGURED_CLIENT/);
  t.teardown(() => {
    process.env.OAUTH_CLIENT_SECRET = clientSecret;
  });
});

test("callback route fails without valid provider", async (t) => {
  const state = globalThis.crypto.randomUUID().replaceAll("-", "");

  const app = express();

  app.use(cookieParser());

  app.get("/callback", middleware.callback);

  const res = await request(app)
    .get(`/callback?code=123456789&state=${state}`)
    .send();

  t.regex(res.text, /UNSUPPORTED_BACKEND/);
});

test("callback route fails without code", async (t) => {
  const state = globalThis.crypto.randomUUID().replaceAll("-", "");

  const app = express();

  app.use(cookieParser());

  app.get("/callback", middleware.callback);

  const res = await request(app)
    .get(`/callback?state=${state}`)
    .set("Cookie", [`csrf-token=github_${state}`])
    .send();

  t.regex(res.text, /AUTH_CODE_REQUEST_FAILED/);
});

test("callback route fails without CSRF token", async (t) => {
  const state = globalThis.crypto.randomUUID().replaceAll("-", "");

  const app = express();

  app.use(cookieParser());

  app.get("/callback", middleware.callback);

  const res = await request(app)
    .get("/callback?code=123456789")
    .set("Cookie", [`csrf-token=github_${state}`])
    .send();

  t.regex(res.text, /AUTH_CODE_REQUEST_FAILED/);
});

test("callback route fails with CSRF mismatch", async (t) => {
  const state = globalThis.crypto.randomUUID().replaceAll("-", "");
  const mismatchedState = globalThis.crypto.randomUUID().replaceAll("-", "");

  const app = express();

  app.use(cookieParser());

  app.get("/callback", middleware.callback);

  const res = await request(app)
    .get(`/callback?code=123456789&state=${mismatchedState}`)
    .set("Cookie", [`csrf-token=github_${state}`])
    .send();

  t.regex(res.text, /CSRF_DETECTED/);
});

test("callback route fails without client ID", async (t) => {
  const clientId = process.env.OAUTH_CLIENT_ID;
  process.env.OAUTH_CLIENT_ID = "";

  const state = globalThis.crypto.randomUUID().replaceAll("-", "");

  const app = express();

  app.use(cookieParser());

  app.get("/callback", middleware.callback);

  const res = await request(app)
    .get(`/callback?code=123456789&state=${state}`)
    .set("Cookie", [`csrf-token=github_${state}`])
    .send();

  t.regex(res.text, /MISCONFIGURED_CLIENT/);

  t.teardown(() => {
    process.env.OAUTH_CLIENT_ID = clientId;
  });
});

test("callback route fails without client secret", async (t) => {
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  process.env.OAUTH_CLIENT_SECRET = "";

  const state = globalThis.crypto.randomUUID().replaceAll("-", "");

  const app = express();

  app.use(cookieParser());

  app.get("/callback", middleware.callback);

  const res = await request(app)
    .get(`/callback?code=123456789&state=${state}`)
    .set("Cookie", [`csrf-token=github_${state}`])
    .send();

  t.regex(res.text, /MISCONFIGURED_CLIENT/);

  t.teardown(() => {
    process.env.OAUTH_CLIENT_SECRET = clientSecret;
  });
});
