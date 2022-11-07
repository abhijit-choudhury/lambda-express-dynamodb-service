declare module "app" {
    class DynamoDBClientParams {
        region?: string;
        endpoint?: string;
    } 
    export = DynamoDBClientParams;
}