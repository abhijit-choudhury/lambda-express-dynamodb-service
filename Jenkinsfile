pipeline {
	agent any
    environment {
        AWS_DEFAULT_REGION="eu-west-1"
    }
    stages {
        stage('Hello') {
            steps {
                sh '''
                aws sts get-caller-identity
                '''
            }
        }
    }
}