/**
 * List of supported OAuth providers.
 */
const supportedProviders = ["github", "gitlab"];

/**
 * Default headers for responses.
 */
const defaultHeaders = {
	"Content-Type": "text/html;charset=UTF-8",
	// Delete CSRF token
	"Set-Cookie":
		"csrf-token=deleted; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure",
};

/**
 * Escape the given string for safe use in a regular expression.
 * @param {string} str - Original string.
 * @returns {string} Escaped string.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#escaping
 */
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const htmlResponse = ({ provider = "unknown", token, error, errorCode }) => {
	const state = error ? "error" : "success";
	const content = error ? { provider, error, errorCode } : { provider, token };

	return `
      <!doctype html><html><body><script>
        (() => {
          window.addEventListener('message', ({ data, origin }) => {
            if (data === 'authorizing:${provider}') {
              window.opener?.postMessage(
                'authorization:${provider}:${state}:${JSON.stringify(content)}',
                origin
              );
            }
          });
          window.opener?.postMessage('authorizing:${provider}', '*');
        })();
      </script></body></html>
    `;
};

const authMiddleware = () => {
	return (req, res) => {
		const { origin, searchParams } = new URL(
			`${req.protocol}://${req.hostname}${req.originalUrl}`,
		);

		const { provider, site_id: domain } = Object.fromEntries(searchParams);

		if (!provider || !supportedProviders.includes(provider)) {
			res.set(defaultHeaders);
			res.send(
				htmlResponse({
					error: "Your Git backend is not supported by the authenticator.",
					errorCode: "UNSUPPORTED_BACKEND",
				}),
			);
			return;
		}

		const {
			ALLOWED_DOMAINS,
			OAUTH_CLIENT_ID,
			OAUTH_CLIENT_SECRET,
			GIT_HOSTNAME = "github.com",
		} = process.env;

		// Check if the domain is whitelisted
		if (
			ALLOWED_DOMAINS &&
			!ALLOWED_DOMAINS.split(/,/).some((str) =>
				// Escape the input, then replace a wildcard for regex
				(domain ?? "").match(
					new RegExp(`^${escapeRegExp(str.trim()).replace("\\*", ".+")}$`),
				),
			)
		) {
			res.set(defaultHeaders);
			res.send(
				htmlResponse({
					provider,
					error: "Your domain is not allowed to use the authenticator.",
					errorCode: "UNSUPPORTED_DOMAIN",
				}),
			);
			return;
		}

		// Generate a random string for CSRF protection
		const csrfToken = globalThis.crypto.randomUUID().replaceAll("-", "");
		let authURL = "";

		if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
			res.set(defaultHeaders);
			res.send(
				htmlResponse({
					provider,
					error: "OAuth app client ID or secret is not configured.",
					errorCode: "MISCONFIGURED_CLIENT",
				}),
			);
			return;
		}

		// GitHub
		if (provider === "github") {
			const params = new URLSearchParams({
				client_id: OAUTH_CLIENT_ID,
				scope: "repo,user",
				state: csrfToken,
			});

			authURL = `https://${GIT_HOSTNAME}/login/oauth/authorize?${params.toString()}`;
		}

		// GitLab
		if (provider === "gitlab") {
			const params = new URLSearchParams({
				client_id: OAUTH_CLIENT_ID,
				redirect_uri: `${origin}/callback`,
				response_type: "code",
				scope: "api",
				state: csrfToken,
			});

			authURL = `https://${GIT_HOSTNAME}/oauth/authorize?${params.toString()}`;
		}

		res.set({
			// Cookie expires in 10 minutes; Use `SameSite=Lax` to make sure the cookie is sent by the
			// browser after redirect
			"Set-Cookie": `csrf-token=${provider}_${csrfToken}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure`,
		});

		res.redirect(authURL);
	};
};

const callbackMiddleware = () => {
	return async (req, res) => {
		const { origin, searchParams } = new URL(
			`${req.protocol}://${req.hostname}${req.originalUrl}`,
		);

		const { code, state } = Object.fromEntries(searchParams);

		const [, provider, csrfToken] =
			req.cookies["csrf-token"]?.match(/([a-z-]+?)_([0-9a-f]{32})/) ?? [];

		if (!provider || !supportedProviders.includes(provider)) {
			res.set(defaultHeaders);
			res.send(
				htmlResponse({
					error: "Your Git backend is not supported by the authenticator.",
					errorCode: "UNSUPPORTED_BACKEND",
				}),
			);
			return;
		}

		if (!code || !state) {
			res.set(defaultHeaders);
			res.send(
				htmlResponse({
					provider,
					error:
						"Failed to receive an authorization code. Please try again later.",
					errorCode: "AUTH_CODE_REQUEST_FAILED",
				}),
			);
			return;
		}

		if (!csrfToken || state !== csrfToken) {
			res.set(defaultHeaders);
			res.send(
				htmlResponse({
					provider,
					error: "Potential CSRF attack detected. Authentication flow aborted.",
					errorCode: "CSRF_DETECTED",
				}),
			);
			return;
		}

		const {
			OAUTH_CLIENT_ID,
			OAUTH_CLIENT_SECRET,
			GIT_HOSTNAME = "github.com",
		} = process.env;

		if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
			res.set(defaultHeaders);
			res.send(
				htmlResponse({
					provider,
					error: "OAuth app client ID or secret is not configured.",
					errorCode: "MISCONFIGURED_CLIENT",
				}),
			);
			return;
		}

		let tokenURL = "";
		let requestBody = {};

		// GitHub
		if (provider === "github") {
			tokenURL = `https://${GIT_HOSTNAME}/login/oauth/access_token`;
			requestBody = {
				code,
				client_id: OAUTH_CLIENT_ID,
				client_secret: OAUTH_CLIENT_SECRET,
			};
		}

		// GitLab
		if (provider === "gitlab") {
			tokenURL = `https://${GIT_HOSTNAME}/oauth/token`;
			requestBody = {
				code,
				client_id: OAUTH_CLIENT_ID,
				client_secret: OAUTH_CLIENT_SECRET,
				grant_type: "authorization_code",
				redirect_uri: `${origin}/callback`,
			};
		}

		let response;
		let token = "";
		let error = "";

		try {
			response = await fetch(tokenURL, {
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestBody),
			});
		} catch {
			//
		}

		if (!response) {
			res.set(defaultHeaders);
			res.send(
				htmlResponse({
					provider,
					error: "Failed to request an access token. Please try again later.",
					errorCode: "TOKEN_REQUEST_FAILED",
				}),
			);
			return;
		}

		try {
			({ access_token: token, error } = response.json());
		} catch {
			res.set(defaultHeaders);
			res.send(
				htmlResponse({
					provider,
					error:
						"Server responded with malformed data. Please try again later.",
					errorCode: "MALFORMED_RESPONSE",
				}),
			);
			return;
		}

		res.set(defaultHeaders);
		res.send(htmlResponse({ provider, token, error }));
	};
};

module.exports = {
	auth: authMiddleware(),
	callback: callbackMiddleware(),
};
