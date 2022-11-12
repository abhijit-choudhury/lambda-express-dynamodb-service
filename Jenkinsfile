pipeline {
	agent any
    environment {
        AWS_DEFAULT_REGION="eu-west-1"
    }
    stages {
        stage('Build') {
            steps {
                sh '''
                    export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
                    nvm use 18.12.1
                    npm i
                '''
            }
        }
        stage('Deploy') {
            steps {
                withCredentials([aws(accessKeyVariable: 'AWS_ACCESS_KEY_ID', credentialsId: 'aws-cred-id', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY')]) {
                    sh '''
                        sls deploy -s $SLS_ENVIRONMENT
                    '''
                }

            }
        }
    }
}