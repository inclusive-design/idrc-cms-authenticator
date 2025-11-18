import process from "node:process";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import request from "supertest";
import { assert, expect, onTestFinished, test } from "vitest";
import middleware from "../middleware/index.js";

const { randomUUID } = require("node:crypto");

dotenv.config({ path: ".env.test", silent: true });

test("auth route fails without valid provider", async () => {
	const app = express();

	app.use(cookieParser());

	app.get("/auth", middleware.auth);

	const res = await request(app)
		.get("/auth?provider=forgejo&site_id=example.com")
		.send();

	assert.isFalse(res.redirect);
	expect(res.text).toMatch(/UNSUPPORTED_BACKEND/);
});

test("auth route fails without valid domain", async () => {
	const app = express();

	app.use(cookieParser());

	app.get("/auth", middleware.auth);

	const res = await request(app)
		.get("/auth?provider=github&site_id=example.test")
		.send();
	assert.isFalse(res.redirect);
	expect(res.text).toMatch(/UNSUPPORTED_DOMAIN/);
});

test("auth route fails without client ID", async () => {
	const clientId = process.env.OAUTH_CLIENT_ID;
	process.env.OAUTH_CLIENT_ID = "";

	const app = express();

	app.use(cookieParser());

	app.get("/auth", middleware.auth);

	const res = await request(app)
		.get("/auth?provider=github&site_id=example.com")
		.send();
	assert.isFalse(res.redirect);
	expect(res.text).toMatch(/MISCONFIGURED_CLIENT/);
	onTestFinished(() => {
		process.env.OAUTH_CLIENT_ID = clientId;
	});
});

test("auth route fails without client secret", async () => {
	const clientSecret = process.env.OAUTH_CLIENT_SECRET;
	process.env.OAUTH_CLIENT_SECRET = "";

	const app = express();

	app.use(cookieParser());

	app.get("/auth", middleware.auth);

	const res = await request(app)
		.get("/auth?provider=github&site_id=example.com")
		.send();
	assert.isFalse(res.redirect);
	expect(res.text).toMatch(/MISCONFIGURED_CLIENT/);
	onTestFinished(() => {
		process.env.OAUTH_CLIENT_SECRET = clientSecret;
	});
});

test("GitHub auth route succeeds with valid provider and site id", async () => {
	const app = express();

	app.use(cookieParser());

	app.get("/auth", middleware.auth);

	const res = await request(app)
		.get("/auth?provider=github&site_id=example.com")
		.send();

	assert.isTrue(res.redirect);
	expect(res.header.location).toMatch(
		/https:\/\/github.com\/login\/oauth\/authorize\?client_id=client-id&scope=repo%2Cuser&state=[a-zA-Z0-9_-]+/,
	);
});

test("GitLab auth route succeeds with valid provider and site id", async () => {
	process.env.GIT_HOSTNAME = "gitlab.com";
	const app = express();

	app.use(cookieParser());

	app.get("/auth", middleware.auth);

	const res = await request(app)
		.get("/auth?provider=gitlab&site_id=example.com")
		.send();

	assert.isTrue(res.redirect);
	expect(res.header.location).toMatch(
		/https:\/\/gitlab.com\/oauth\/authorize\?client_id=client-id&redirect_uri=http%3A%2F%2F127\.0\.0\.1%2Fcallback&response_type=code&scope=api&state=[a-zA-Z0-9_-]+/,
	);
	onTestFinished(() => {
		process.env.GIT_HOSTNAME = "github.com";
	});
});

test("callback route fails without valid provider", async () => {
	const state = randomUUID().replaceAll("-", "");

	const app = express();

	app.use(cookieParser());

	app.get("/callback", middleware.callback);

	const res = await request(app)
		.get(`/callback?code=123456789&state=${state}`)
		.send();

	expect(res.text).toMatch(/UNSUPPORTED_BACKEND/);
});

test("callback route fails without code", async () => {
	const state = randomUUID().replaceAll("-", "");

	const app = express();

	app.use(cookieParser());

	app.get("/callback", middleware.callback);

	const res = await request(app)
		.get(`/callback?state=${state}`)
		.set("Cookie", [`csrf-token=github_${state}`])
		.send();

	expect(res.text).toMatch(/AUTH_CODE_REQUEST_FAILED/);
});

test("callback route fails without CSRF token", async () => {
	const state = randomUUID().replaceAll("-", "");

	const app = express();

	app.use(cookieParser());

	app.get("/callback", middleware.callback);

	const res = await request(app)
		.get("/callback?code=123456789")
		.set("Cookie", [`csrf-token=github_${state}`])
		.send();

	expect(res.text).toMatch(/AUTH_CODE_REQUEST_FAILED/);
});

test("callback route fails with CSRF mismatch", async () => {
	const state = randomUUID().replaceAll("-", "");
	const mismatchedState = randomUUID().replaceAll("-", "");

	const app = express();

	app.use(cookieParser());

	app.get("/callback", middleware.callback);

	const res = await request(app)
		.get(`/callback?code=123456789&state=${mismatchedState}`)
		.set("Cookie", [`csrf-token=github_${state}`])
		.send();

	expect(res.text).toMatch(/CSRF_DETECTED/);
});

test("callback route fails without client ID", async () => {
	const clientId = process.env.OAUTH_CLIENT_ID;
	process.env.OAUTH_CLIENT_ID = "";

	const state = randomUUID().replaceAll("-", "");

	const app = express();

	app.use(cookieParser());

	app.get("/callback", middleware.callback);

	const res = await request(app)
		.get(`/callback?code=123456789&state=${state}`)
		.set("Cookie", [`csrf-token=github_${state}`])
		.send();

	expect(res.text).toMatch(/MISCONFIGURED_CLIENT/);

	onTestFinished(() => {
		process.env.OAUTH_CLIENT_ID = clientId;
	});
});

test("callback route fails without client secret", async () => {
	const clientSecret = process.env.OAUTH_CLIENT_SECRET;
	process.env.OAUTH_CLIENT_SECRET = "";

	const state = randomUUID().replaceAll("-", "");

	const app = express();

	app.use(cookieParser());

	app.get("/callback", middleware.callback);

	const res = await request(app)
		.get(`/callback?code=123456789&state=${state}`)
		.set("Cookie", [`csrf-token=github_${state}`])
		.send();

	expect(res.text).toMatch(/MISCONFIGURED_CLIENT/);

	onTestFinished(() => {
		process.env.OAUTH_CLIENT_SECRET = clientSecret;
	});
});
