FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# Do not remove the 'apk update && apk upgrade' commands below. Workaround for installing latest
# Alpine security updates in case upstream images don't get built and pushed regularly.
RUN apk update && \
    apk upgrade --no-cache && \
    npm i

COPY . .

EXPOSE 3000
CMD [ "npm", "start" ]
