pipeline {
	agent any
    environment {
        AWS_DEFAULT_REGION="eu-west-1"
    }
    stages {
        stage('Build') {
            steps {
                sh '''
                    nvm use 18.12.1
                    npm i
                '''
            }
        }
        stage('Deploy') {
            steps {
                withAWS(credentials: 'sls-creds') {
                    sh '''
                        sls deploy -s $SLS_ENVIRONMENT
                    '''
                }
            }
        }
    }
}