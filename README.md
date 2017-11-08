# Hubot

```
                     _______________
                    /               \
   //\              |   Greetings   |
  ////\    _____    |               |
 //////\  /_____\   \               /
 ======= |[^_/\_]|   /--------------
  |   | _|___@@__|__
  +===+/  ///     \_\
   | |_\ /// HUBOT/\\
   |___/\//      /  \\
         \      /   +---+
          \____/    |   |
           | //|    +===+
            \//      |xx|
 ```           
            

Hubot is a chat bot built on the [Hubot](https://hubot.github.com/docs) framework.
This version is designed to be deployed on [Heroku](www.heroku.com). 

# Documentation

## How to run: 

There are 3 ways to run hubot. Local, on Heroku or using Docker.

### Run on Heroku 
(Recommended for easy and fast run)<br>

Just press the Deploy Button bellow, add the environment variables and you are ready to go. <br>
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

### Run Local
Requirements: 

Firstly, make sure you have installed nodejs & npm and dependencies:
    
    % sudo apt-get install nodejs npm
    % apt-get install build-essential libssl-dev git-core libexpat1-dev
  
To run hubot local you will need to clone it first:

    % mkdir hubot && cd hubot
    % git clone https://github.com/AuthEceSoftEng/chatops.git      
    
Install project's depenndencies. Inside hubot directory run: 

    % npm install 

For using Hubot in slack and using all his available integrations, you must set all the needed environment variables. Example of those vatriables can be found in the file env_example
Set the environment variables using `% export` or create a file `.env` in $HOME directory:

    % cd $HOME
    % touch .env
    % pico .env
    Add your environment variables in this form: ENV_VAR_NAME=VALUE
    
To run the bot:
    
    % ./bin/hubot -a adapter slack

You are ready to go

When running local you will not be able to set up any webhooks unless you set a public host url.<br>
One way to do this is by using ngrok tool. 
    
    % ngrok http $PORT
    Hubot by default listens on port 8080

### Run using Docker

For using docker, first install docker cli. 

After that, you have to create a docker image using the follow command:  

    % sudo docker build https://github.com/AuthEceSoftEng/chatops --tag <image_repo_name>:<image_tag_name>
    OR 
    % git clone https://github.com/AuthEceSoftEng/chatops.git      
    % sudo docker build . --tag <image_repo_name>:<image_tag_name>

Set the environment variables:

    % touch env
    % pico env
    Add your environment variables in this form: ENV_VAR_NAME=VALUE

Run the image: 
    
    % sudo docker run -it --name <container_name> --env-file env <image_repository_name>:<image_tag_name>

## Environment Variables

You need to set some environment variables to take full advantage of Hubot. 
Here is a list of all the environment variables. A more deep explanation for most of them can be found in the Integraions Set-up section. 
    
    HUBOT_SLACK_TOKEN

    HUBOT_HOST_URL=(e.g. <HUBOT_URL>:<PORT> OR https://<heroku_app_name>.herokuapp.com/)
    MONGODB_URL=(e.g. for mlab addon on heroku: mongodb://XXXX:XXXX@XXXX.mlab.com:<PORT>/XXXX)
    
    ENCRYPTION_ALGORITHM=aes-256-ctr
    ENCRYPTION_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (a 32 char key of your choice)

    JENKINS_URL   

    APIAI_TOKEN

    GITHUB_APP_ID
    GITHUB_WEBHOOK_SECRET
    GITHUB_APP_CLIENT_ID
    GITHUB_APP_CLIENT_SECRET
    GITHUB_PEM OR GITHUB_PEM_DIR

    HUBOT_TRELLO_KEY
    HUBOT_TRELLO_TEAM
    HUBOT_TRELLO_OAUTH
    
    HUBOT_EMAIL=(Hubot's email account. e.g. hubot@outlook.com)
    HUBOT_EMAIL_PASS=(Hubot's email account password)
    STANDUPS_EMAIL=(a preconfigure email for sending standups reports)

## Integrations Set-Up

### Slack
To use hubot, you will need a [hubot slack integration](https://hubotdevteam.slack.com/apps/A0F7XDU93-hubot). 
Follow the link above and click “Add Configuration”. Slack will ask you to designate a username for your bot.

![Screenshot](readme_files/slack_hubot.png)

Once the username is provided, Slack will create an account on your team with that username and assign it an API token. It is very important that you keep this API token a secret, so do not check it into your git repository. This statement exists for all integration tokens. You’ll also have the option to customize your bot’s icon, first and last name, what it does, and so forth.

![Screenshot](readme_files/slack_token.png)

Set the slack api token to env variable: HUBOT_SLACK_TOKEN.


### GitHub

1. To use GitHub integration you must first register a new [GitHub App](https://developer.github.com/apps/building-integrations/setting-up-and-registering-github-apps/registering-github-apps/) in you account or organization.

2. After a GitHub App is registered, you'll need to generate a **private key**. To generate a private key, click on your app's name, then click the Generate private key button. Open the .pem file in any text editor and paste the content in the relevant field in environment variables.

![Screenshot](readme_files/github_pem_example.png)

3. You you also need the **app ID** and **OAuth credentials** and specificly you need **Client ID** and **Client Secret** where you can find them at the bottom of the GitHub App's page.

![Screenshot](readme_files/github_app_credentials.png)

4. Configure App as bellow. 

![Screenshot](readme_files/github_app_settings.png)

### Trello 
To use trello integration you must provide **Trello API Key**, **OAuth Secret** and **your Team name**. 
You can find them all in [trello's api page](https://trello.com/app-key), as shown in the screenshots bellow.  

![Screenshot](readme_files/trello_key.png)
![Screenshot](readme_files/trello_oauth.png)

### Jenkins 
To use jenkins you must provide your jenkins' url. 
For build notifications you must install [Jenkins Notification Plugin](https://wiki.jenkins.io/display/JENKINS/Notification+Plugin)

After that, configure the Plugin: 
1. Add hubot's endpoint to jenkins jobs: (see Screenshot)
2. Configure it to be JSON, HTTP and either "All events", "Job started" or "Job finalized". "Job completed" will be ignored.
3. To send to a room: http://<hubot-host>:<hubot-port>/hubot/jenkins-notifications?room=<room>
4. To send to a user: http://<hubot-host>:<hubot-port>/hubot/jenkins-notifications?user=<username>
5. Add log lines if you want to
  
![Screenshot](readme_files/jenkins_notifications_plugin.png)

### Dialogflow (ex API.AI)

1. Create a new dialogflow [account](https://console.dialogflow.com/api-client/#/login) 
2. Create a new Agent
3. Download dialogflow.zip file from the repository root 
4. Import data as shown in the screenshot bellow 
![Screenshot](readme_files/dialogflow_data.png)
5. Set APIAI_TOKEN=(Client access token). For the token, check the screenshot bellow 
![Screenshot](readme_files/dialogflow_token.png)

### Standup Meetings - Daily Reports 

Hubot provides a descent way for users to post reports to a common slack channel. 
These reports can be sent in a CSV format via email. For that reason, hubot must:
* Own an email account (tested on outlook and gmail)
* (optional) Know a preconfigured email address to send the reports.

Set these env variabes:
    
    HUBOT_EMAIL=(Hubot's email account. e.g. hubot@outlook.com)
    HUBOT_EMAIL_PASS=(Hubot's email account password)
    STANDUPS_EMAIL=(a preconfigure email for sending standups reports)

##  Scripting
First, read the full Hubot Framework [Scripting Documentation](https://hubot.github.com/docs/scripting/)

### Add functionality to existing integrations
Every integration's functionality is developed in a separate script file. The file name is something like `<integration_name>-integration.js` (e.g. github-integration.js). 

Theses files contain all the necessary listeners for human-to-bot commands. You can add more listeners for new API requests. For the requests you will need user's credentials that can be returned as an Object using the function `getCredentails(userid)` where userid is the user's slack id. 

### Add new integrations
You can add new integrations by creating and developing new script files. 

In cases where integrations use slack member's credentials, a good idea is to store them in mongoDB or in robot.brain or in cache (see brain.js and cache.js). Be aware that in this hubot implementation, robot.brain functions were avoided due to "request time out" bugs. For this reason, a cache moduled was used.  

You can encrypt/decrypt tokens using the functions provides by the encryption.js script. 

In this implementation, tokens are encrypted and stored in mongoDB but they are also saved in their original form (decrypted) in cache for fetching them faster. To do so, they are saved immediately in cache every time a new token i created or every time the bot (re)starts. This procedure is taking place in brain.js script using functions from the cache.js script.

## Bug Reporting & QnA
Feel free to report a new bug or ask a question using issues.  
