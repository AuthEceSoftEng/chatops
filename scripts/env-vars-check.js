module.exports = (robot) => {
    missingEnvVars()

    // check for environment variables
    function missingEnvVars() {
        var missing = false
        if (!process.env.APIAI_TOKEN) {
            missing = true
            robot.logger.warning('Missing environment variable APIAI_TOKEN')
        }
        if (!process.env.ENCRYPTION_ALGORITHM) {
            process.env.ENCRYPTION_ALGORITHM='aes-256-ctr'
        }
        if (!process.env.ENCRYPTION_KEY) {
            process.env.ENCRYPTION_KEY='qg31qsANkNtcTdL9WrLAHSRG3Zs1oaSg'
            robot.logger.warning('Using the default  ENCRYPTION_KEY')
        }
        if (!process.env.GITHUB_APP_ID) {
            missing = true
            robot.logger.warning('Missing environment variable GITHUP_APP_ID')
        }
        if (!process.env.HUBOT_HOST_URL) {
            missing = true
            robot.logger.warning('Missing environment variable HUBOT_HOST_URL')
        }
        if (!process.env.HUBOT_SLACK_TOKEN) {
            missing = true
            robot.logger.warning('Missing environment variable HUBOT_SLACK_TOKEN')
        }
        if (!process.env.HUBOT_TRELLO_KEY) {
            missing = true
            robot.logger.warning('Missing environment variable HUBOT_TRELLO_KEY')
        }
        if (!process.env.HUBOT_TRELLO_TEAM) {
            missing = true
            robot.logger.warning('Missing environment variable HUBOT_TRELLO_TEAM')
        }
        if (!process.env.HUBOT_TRELLO_OAUTH) {
            missing = true
            robot.logger.warning('Missing environment variable HUBOT_TRELLO_OAUTH')
        }
        if (!process.env.JENKINS_URL) {
            missing = true
            robot.logger.warning('Missing environment variable JENKINS_URL')
        }
        if (!process.env.MONGODB_URL) {
            if (process.env.MONGOLAB_URI) {
                /* This is when setting up a heroku mLab addon. 
                 * in which a MONGOLAB_URI env var created by default
                 */
                process.env.MONGODB_URL = process.env.MONGOLAB_URI
            } else {
                missing = true
                robot.logger.warning('Missing environment variable MONGODB_URL')
            }
        }
        if (!process.env.GITHUB_PEM_DIR) {
            missing = true
            robot.logger.warning('Missing environment variable GITHUB_PEM_DIR')
        }
        return missing
    }
}