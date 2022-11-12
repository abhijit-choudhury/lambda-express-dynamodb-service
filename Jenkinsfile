pipeline {
	agent any
    environment {
        AWS_DEFAULT_REGION="eu-west-1"
    }
    stages {
        stage('Hello') {
            steps {
                withCredentials([aws(accessKeyVariable: 'AWS_ACCESS_KEY_ID', credentialsId: 'aws-cred-id', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY')]) {
                    sh '''
                        npm i
                        sls deploy -s $SLS_ENVIRONMENT
                        aws sts get-caller-identity
                    '''
                }

            }
        }
    }
}