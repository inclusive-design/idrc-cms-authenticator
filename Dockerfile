FROM node:24.10.0-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# Do not remove the 'apk upgrade --no-cache' command below. Workaround for installing latest
# Alpine OS security updates in case upstream images don't get built and pushed regularly.
#
# Pass the following 'docker build' argument to invalidate layer caching and force this step to
# always run: --build-arg CACHE_BUST=$(date +%s)
ARG CACHE_BUST=1
RUN apk upgrade --no-cache && \
    echo "Cache bust: $CACHE_BUST" && \
    npm ci

COPY . .

EXPOSE 3000
CMD [ "npm", "start" ]
