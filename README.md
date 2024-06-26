# IDRC CMS Authenticator

[![BSD 3-Clause license](https://badgen.net/github/license/inclusive-design/idrc-cms-authenticator)](https://github.com/inclusive-design/idrc-cms-authenticator/blob/main/LICENSE.md)
[![Latest release](https://badgen.net/github/release/inclusive-design/idrc-cms-authenticator)](https://github.com/inclusive-design/idrc-cms-authenticator/releases/latest)
[![codecov](https://codecov.io/gh/inclusive-design/idrc-cms-authenticator/graph/badge.svg?token=7DVX7LF4BH)](https://codecov.io/gh/inclusive-design/idrc-cms-authenticator)

A simple [Express](https://expressjs.com/) application which allows [Sveltia CMS](https://github.com/sveltia/sveltia-cms) or [Decap CMS](https://decapcms.org) to authenticate with [GitHub](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) or [GitLab](https://docs.gitlab.com/ee/api/oauth2.html#authorization-code-flow).

Based on [netlify-cms-github-oauth-provider](https://github.com/vencax/netlify-cms-github-oauth-provider) and [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth).

## Usage

### Configuration

1. Create an OAuth application on [GitHub](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) or [GitLab](https://docs.gitlab.com/ee/integration/oauth_provider.html). Make sure to set the **authorization callback URL** to the `callback` route of the deployed application. For example, if you were going to deploy the IDRC CMS Authenticator to `https://auth.example.com`, the **authorization callback URL** would be `https://auth.example.com/callback`.
2. Configure environment variables for the application in a `.env` file:

```bash
# Domain patterns for CMS installations using the IDRC CMS Authenticator
ALLOWED_DOMAINS=example.com,*.example.com
# GitHub or GitLab OAuth application client ID
OAUTH_CLIENT_ID=""
# GitHub or GitLab OAuth application client secret
OAUTH_CLIENT_SECRET=""
```

If you are using GitHub Enterprise Server or a self-hosted instance of GitLab you'll also need to set `GIT_HOSTNAME` to the hostname of your server.

### Serving locally

1. Install the required packages: `npm install`
2. Run the application: `npm start`

The application will be available at <http://localhost:3000>.

**Note:** that the authorization callback cannot redirect to a `localhost` URL, but you will be able to test the authorization flow.

### Serving locally using Docker

You can also build and serve the application locally from a [Docker](https://docs.docker.com/get-docker) container.

With Docker installed, run the following commands to build a Docker image and start a container:

1. Build the image: `docker build -t idrc-cms-authenticator .`
2. Run the container: `docker run --name idrc-cms-authenticator -p 3000:3000 idrc-cms-authenticator`

The server will be available at <http://localhost:3000>.

**Note:** the authorization callback cannot redirect to a `localhost` URL, but you will be able to test the authorization flow.

### Deployment using Docker Compose

The project contains an example [Docker Compose file](docker-compose.yml) which can be used as a basis for deploying the application with Docker Compose. For more information on how to modify the file for this purpose, see ["Use Compose in production"](https://docs.docker.com/compose/production/).

## License

IDRC CMS Authenticator is available under the [New BSD License](https://raw.githubusercontent.com/inclusive-design/idrc-cms-authenticator/main/LICENSE.md).

## Third Party Software in IDRC CMS Authenticator

IDRC CMS Authenticator is based on other publicly available software, categorized by license:

### MIT License

* [netlify-cms-github-oauth-provider](https://github.com/vencax/netlify-cms-github-oauth-provider)
* [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth)
