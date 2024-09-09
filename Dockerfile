# lets start from an image that already has nodejs installed
FROM node:22.8.0-bookworm-slim  as base

RUN groupadd -g 1014 dc_user \
&& useradd -rm -d /usr/src/app -u 1015 -g dc_user dc_user
USER dc_user

# Essentially running mkdir <name> inside the current working
# directory, and then cd <name>
WORKDIR /usr/src/app
#no chnage made
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# Default to production. npm will ignore devDependencies in production mode
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# RUN npm install
# If you are building your code for production
RUN npm ci

# Bundle app source
COPY . .

# Download RDS certificates bundle for SSL verification
ADD --chown=dc_user https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem ./ca/rds-combined-ca-bundle.pem

# Expose port 3100 inside the container to the outside world
# so that http://localhost:3100 routes the network traffic to
# the container
EXPOSE 3100

USER 1015
# the command line to run when the container is started
CMD [ "npm", "start" ]
