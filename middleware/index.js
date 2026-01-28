import {env} from 'node:process';
import {randomUUID} from 'node:crypto';

/**
 * List of supported OAuth providers.
 */
const supportedProviders = new Set(['github', 'gitlab']);

/**
 * Default headers for responses.
 */
const defaultHeaders = {
	'Content-Type': 'text/html;charset=UTF-8',
	// Delete CSRF token
	'Set-Cookie':
		'csrf-token=deleted; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure',
};

/**
 * Escape the given string for safe use in a regular expression.
 * @param {string} string_ - Original string.
 * @returns {string} Escaped string.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#escaping
 */
const escapeRegExp = string_ => string_.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const htmlResponse = ({provider = 'unknown', token, error, errorCode}) => {
	const state = error ? 'error' : 'success';
	const content = error ? {provider, error, errorCode} : {provider, token};

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

const authMiddleware = (request, response) => {
	const {origin, searchParams} = new URL(`${request.protocol}://${request.hostname}${request.originalUrl}`);

	const {provider, site_id: domain} = Object.fromEntries(searchParams);

	if (!provider || !supportedProviders.has(provider)) {
		response.set(defaultHeaders);
		response.send(htmlResponse({
			error: 'Your Git backend is not supported by the authenticator.',
			errorCode: 'UNSUPPORTED_BACKEND',
		}));
		return;
	}

	const {
		ALLOWED_DOMAINS,
		OAUTH_CLIENT_ID,
		OAUTH_CLIENT_SECRET,
		GIT_HOSTNAME = provider === 'github' ? 'github.com' : 'gitlab.com',
	} = env;

	// Check if the domain is whitelisted
	if (
		ALLOWED_DOMAINS
		&& !ALLOWED_DOMAINS.split(/,/).some(string_ =>
		// Escape the input, then replace a wildcard for regex
			(domain ?? '').match(new RegExp(`^${escapeRegExp(string_.trim()).replace(String.raw`\*`, '.+')}$`)))
	) {
		response.set(defaultHeaders);
		response.send(htmlResponse({
			provider,
			error: 'Your domain is not allowed to use the authenticator.',
			errorCode: 'UNSUPPORTED_DOMAIN',
		}));
		return;
	}

	// Generate a random string for CSRF protection
	const csrfToken = randomUUID().replaceAll('-', '');
	let authURL = '';

	if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
		response.set(defaultHeaders);
		response.send(htmlResponse({
			provider,
			error: 'OAuth app client ID or secret is not configured.',
			errorCode: 'MISCONFIGURED_CLIENT',
		}));
		return;
	}

	// GitHub
	if (provider === 'github') {
		const parameters = new URLSearchParams({
			client_id: OAUTH_CLIENT_ID,
			scope: 'repo,user',
			state: csrfToken,
		});

		authURL = `https://${GIT_HOSTNAME}/login/oauth/authorize?${parameters.toString()}`;
	}

	// GitLab
	if (provider === 'gitlab') {
		const parameters = new URLSearchParams({
			client_id: OAUTH_CLIENT_ID,
			redirect_uri: `${origin}/callback`,
			response_type: 'code',
			scope: 'api',
			state: csrfToken,
		});

		authURL = `https://${GIT_HOSTNAME}/oauth/authorize?${parameters.toString()}`;
	}

	response.set({
		// Cookie expires in 10 minutes; Use `SameSite=Lax` to make sure the cookie is sent by the
		// browser after redirect
		'Set-Cookie': `csrf-token=${provider}_${csrfToken}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure`,
	});

	response.redirect(authURL);
};

const callbackMiddleware = async (request, response) => {
	const {origin, searchParams} = new URL(`${request.protocol}://${request.hostname}${request.originalUrl}`);

	const {code, state} = Object.fromEntries(searchParams);

	const [, provider, csrfToken]
		= request.cookies['csrf-token']?.match(/([a-z-]+?)_([0-9a-f]{32})/) ?? [];

	if (!provider || !supportedProviders.has(provider)) {
		response.set(defaultHeaders);
		response.send(htmlResponse({
			error: 'Your Git backend is not supported by the authenticator.',
			errorCode: 'UNSUPPORTED_BACKEND',
		}));
		return;
	}

	if (!code || !state) {
		response.set(defaultHeaders);
		response.send(htmlResponse({
			provider,
			error:
						'Failed to receive an authorization code. Please try again later.',
			errorCode: 'AUTH_CODE_REQUEST_FAILED',
		}));
		return;
	}

	if (!csrfToken || state !== csrfToken) {
		response.set(defaultHeaders);
		response.send(htmlResponse({
			provider,
			error: 'Potential CSRF attack detected. Authentication flow aborted.',
			errorCode: 'CSRF_DETECTED',
		}));
		return;
	}

	const {
		OAUTH_CLIENT_ID,
		OAUTH_CLIENT_SECRET,
		GIT_HOSTNAME = provider === 'github' ? 'github.com' : 'gitlab.com',
	} = env;

	if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
		response.set(defaultHeaders);
		response.send(htmlResponse({
			provider,
			error: 'OAuth app client ID or secret is not configured.',
			errorCode: 'MISCONFIGURED_CLIENT',
		}));
		return;
	}

	let tokenURL = '';
	let requestBody = {};

	// GitHub
	if (provider === 'github') {
		tokenURL = `https://${GIT_HOSTNAME}/login/oauth/access_token`;
		requestBody = {
			code,
			client_id: OAUTH_CLIENT_ID,
			client_secret: OAUTH_CLIENT_SECRET,
		};
	}

	// GitLab
	if (provider === 'gitlab') {
		tokenURL = `https://${GIT_HOSTNAME}/oauth/token`;
		requestBody = {
			code,
			client_id: OAUTH_CLIENT_ID,
			client_secret: OAUTH_CLIENT_SECRET,
			grant_type: 'authorization_code',
			redirect_uri: `${origin}/callback`,
		};
	}

	let tokenResponse;
	let token = '';
	let error = '';

	try {
		tokenResponse = await fetch(tokenURL, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(requestBody),
		});
	} catch {
		response.set(defaultHeaders);
		response.send(htmlResponse({
			provider,
			error: 'Failed to request an access token. Please try again later.',
			errorCode: 'TOKEN_REQUEST_FAILED',
		}));
		return;
	}

	try {
		({access_token: token, error} = await tokenResponse.json());
	} catch {
		response.set(defaultHeaders);
		response.send(htmlResponse({
			provider,
			error:
						'Server responded with malformed data. Please try again later.',
			errorCode: 'MALFORMED_RESPONSE',
		}));
		return;
	}

	response.set(defaultHeaders);
	response.send(htmlResponse({provider, token, error}));
};

export default {
	auth: authMiddleware,
	callback: callbackMiddleware,
};
