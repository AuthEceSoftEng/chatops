FROM node:6.11.0-alpine

RUN mkdir /opt/hubot
WORKDIR /opt/hubot

# Install Hubot-Framework Dependencies
RUN npm install -g hubot coffee-script yo generator-hubot

# user node
RUN chown -R node /opt/hubot
USER node

# Set Environment Variables
# inlcude all environment variables in a file and use it in 'run' command like this: --env-file <filename>
# Vars should be like this: ENV_VAR_NAME=value
ENV HUBOT_PORT=8080
ENV HUBOT_OWNER="Andreas Hadjithomas"
ENV HUBOT_NAME="hubot"
ENV HUBOT_DESCRIPTION="Hubot for chatOps"

# Install Hubot
RUN yo hubot --owner=${HUBOT_OWNER} --name=${HUBOT_NAME} --description=${HUBOT_DESCRIPTION} --adapter=slack --defaults --allow-root

# Install Slack adapter
RUN npm install hubot-slack

# Load Scripts
ADD scripts/ /opt/hubot/scripts
ADD external-scripts.json /opt/hubot/external-scripts.json

# Install App's Dependecnies
ADD package.json /opt/hubot/package.json
RUN npm install

# Set port 
EXPOSE ${HUBOT_PORT}

# Run
CMD ["./bin/hubot", "--adapter", "slack"]