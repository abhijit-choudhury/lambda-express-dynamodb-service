<!--
title: 'Serverless Framework Node Express API service backed by DynamoDB on AWS'
description: 'This template demonstrates how to develop and deploy a simple Node Express API service backed by DynamoDB running on AWS Lambda using the traditional Serverless Framework.'
layout: Doc
framework: v3
platform: AWS
language: nodeJS
priority: 1
authorLink: 'https://github.com/serverless'
authorName: 'Serverless, inc.'
authorAvatar: 'https://avatars1.githubusercontent.com/u/13742415?s=200&v=4'
-->

# Serverless Framework Node Express API on AWS

This template demonstrates how to develop and deploy a simple Node Express API service, backed by DynamoDB database, running on AWS Lambda using the traditional Serverless Framework.


## Anatomy of the template

This template configures a single function, `api`, which is responsible for handling all incoming requests thanks to the `httpApi` event. To learn more about `httpApi` event configuration options, please refer to [httpApi event docs](https://www.serverless.com/framework/docs/providers/aws/events/http-api/). As the event is configured in a way to accept all incoming requests, `express` framework is responsible for routing and handling requests internally. Implementation takes advantage of `serverless-http` package, which allows you to wrap existing `express` applications. To learn more about `serverless-http`, please refer to corresponding [GitHub repository](https://github.com/dougmoscrop/serverless-http). Additionally, it also handles provisioning of a DynamoDB database that is used for storing data about users. The `express` application exposes two endpoints, `POST /users` and `GET /user/{userId}`, which allow to create and retrieve users.

## Usage

### Roles and Permissions
Permission could be listed out in serverless.yml but incase external roles must be leveraged then create a Policy with the desired permissions (DynamoDB READ WRITE..) then create a Role attached to the Policy and add that into the env file, which gets further referenced into serverless.yml

### Deployment

Install dependencies with:

```
npm install
```

and then deploy with:

```
serverless deploy
serverless deploy -s prod
```

After running deploy, you should see output similar to:

```bash
Deploying lambda-express-dynamodb-service-project to stage dev (us-east-1)

✔ Service deployed to stack lambda-express-dynamodb-service-project-dev (196s)

endpoint: ANY - https://xxxxxxxxxx.execute-api.eu-west-1.amazonaws.com
functions:
  api: lambda-express-dynamodb-service-project-dev-api (766 kB)
```

_Note_: In current form, after deployment, your API is public and can be invoked by anyone. For production deployments, you might want to configure an authorizer. For details on how to do that, refer to [`httpApi` event docs](https://www.serverless.com/framework/docs/providers/aws/events/http-api/). Additionally, in current configuration, the DynamoDB table will be removed when running `serverless remove`. To retain the DynamoDB table even after removal of the stack, add `DeletionPolicy: Retain` to its resource definition.

### Invocation

After successful deployment, you can create a new user by calling the corresponding endpoint:

```bash
curl --request POST 'https://xxxxxx.execute-api.eu-west-1.amazonaws.com/basket' --header 'Content-Type: application/json' --data-raw '{"basketId": "1667669951","data": "blah blah"}'
```

Which should result in the following response:

```bash
{"basketId": "1667669951"}
```
Response Cookie 
    userId:89f16e5d-7146-4f31-bb31-544c8aa407b6

You can later retrieve the user by `userId` by calling the following endpoint:

```bash
curl https://xxxxxxx.execute-api.eu-west-1.amazonaws.com/basket/1667669951
```
Request Cookie
    userId:89f16e5d-7146-4f31-bb31-544c8aa407b6

Which should result in the following response:

```bash
{"userId": "89f16e5d-7146-4f31-bb31-544c8aa407b6","data": "blah blah"}
```

If you try to retrieve user that does not exist, you should receive the following response:

```bash
{"error":"Could not find user with provided \"userId\""}
```

### Local development

It is also possible to emulate DynamoDB, API Gateway and Lambda locally using the `serverless-dynamodb-local` and `serverless-offline` plugins. In order to do that, install local dynamodb and then run plugin install commands:

```bash
serverless dynamodb install
serverless plugin install -n serverless-dynamodb-local
serverless plugin install -n serverless-offline
```

It will add both plugins to `devDependencies` in `package.json` file as well as will add it to `plugins` in `serverless.yml`. Make sure that `serverless-offline` is listed as last plugin in `plugins` section as below:

```
plugins:
  - serverless-dynamodb-local
  - serverless-offline
```

You should also add the following config to `custom` section in `serverless.yml`:

```
custom:
  (...)
  dynamodb:
    start:
      migrate: true
    stages:
      - dev
```

Additionally, we need to reconfigure `AWS.DynamoDB.DocumentClient` to connect to our local instance of DynamoDB. We can take advantage of `IS_OFFLINE` environment variable set by `serverless-offline` plugin and replace:

```javascript
const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
```

with the following:

```javascript
const dynamoDbClientParams = {};
if (process.env.IS_OFFLINE) {
  dynamoDbClientParams.region = 'localhost'
  dynamoDbClientParams.endpoint = 'http://localhost:8000'
}
const dynamoDbClient = new AWS.DynamoDB.DocumentClient(dynamoDbClientParams);
```

After that, running the following command with start both local API Gateway emulator as well as local instance of emulated DynamoDB:

```bash
serverless offline start
```

To learn more about the capabilities of `serverless-offline` and `serverless-dynamodb-local`, please refer to their corresponding GitHub repositories:
- https://github.com/dherault/serverless-offline
- https://github.com/99x/serverless-dynamodb-local

## FAQ

### Accidental Project Deletion

Never Execute

```bash
sls remove
```
In off chance someone accidentally deletes the setup by running 'sls remove', the DB will not get deleted as we have put DeletionPolicy: Retain, but then going forward we will have to deploy DB changes manually

To reinstate
1. Comment the line in serverless.yml for managing dynamodb resource
2. Redeploy the project with the above commented serverless.yml
3. We would also then need to repoint Akamai to repoint to new api gateway domain that gets generated

## CICD
Added Jenkinsfile to the project
SSH into Jenkins Server
1. Install nvm into the build server as it allows the flexibility to swap node versions
2. Install desired node versions using nvm
3. Install serverless
On Jenkins Portal
1. Install Pipeline: AWS Steps plugin
2. Add a credential in Jenkins with type AWS Credential
3. Add a global environment variable for SLS_ENVIRONMENT for setting the right SLS stage 
4. Finally create a multibranch pipeline job and configure the git source