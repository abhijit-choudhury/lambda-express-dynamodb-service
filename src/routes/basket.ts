import { DynamoDB, SecretsManager } from "aws-sdk";
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import express, { Request, Response, Router } from "express";
import crypto from "crypto";
import { dynamoDBDocClient } from "../libs/dynamodbDocClient"

const secretsManager = new SecretsManager();
const MY_SECRET_NAME = process.env.MY_SECRET_NAME as string;

const router: Router = express.Router();

const USERS_TABLE = process.env.USERS_TABLE as string;
const USERS_TABLE_USERID_LASTUPDATED_LSI = process.env.USERS_TABLE_USERID_LASTUPDATED_LSI as string;

router.get("/:basketId", async function (req: Request, res: Response) {
    try {
        const userId = req.cookies["userId"];
        const basketId = req.params.basketId;

        //Request Validation
        if (!userId) {
            res.status(400).json({ error: 'userId not present' });
        } else if (!basketId) {
            res.status(400).json({ error: 'basketId not present' });
        }

        console.log(`Inputs userId: ${userId} basketId:${basketId}`);

        const params: DynamoDB.DocumentClient.GetItemInput = {
            TableName: USERS_TABLE,
            Key: {
                userId,
                basketId
            },
            AttributesToGet: [
                "userId",
                "data",
                "loginId"
            ],
            ConsistentRead: false,
        };

        /*
        AttributesToGet - Gets the entire attribute, could be single valued, multivalued (list or map), we cant get individual items from the multivalued attributes

        ProjectionExpression - Behaves much like AttributesToGet but is more powerful in terms of being able to fetch things from within multivalued attributes, e.g. the first element in a list (RelatedItems[0]), and a list nested within a map (ProductReviews.FiveStar)

        Note that AttributesToGet or Projection Expression has no effect on provisioned throughput consumption. DynamoDB determines capacity units consumed based on item size, not on the amount of data that is returned to an application
        */

        const { Item } = await dynamoDBDocClient.send(new GetCommand(params));

        if (Item) {
            const { userId, data, loginId } = Item;
            res.status(200).json({ userId, data, loginId });
        } else {
            res.status(404).json({ error: "Could not find the basket with provided userId and basketId" });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Could not retreive basket" });
    }
});

router.get("/", async function (req: Request, res: Response) {
    try {
        const userId = req.cookies["userId"];

        //Request Validation
        if (!userId) {
            res.status(400).json({ error: 'userId not present' });
        }

        console.log(`Inputs userId: ${userId}`);

        /**
         * Batch Get vs Query vs Scan
         * For BatchGet we need to specify all the different composite keys for all items we need to fetch, we can fetch max of 100 items or 16MB of data.
         * 
         * For Query we can pass the primary partition/hash key (for Primary Index or Local Secondary Index/LSI) or secondary partition/hash key (for Global Secondary Index/GSI)
         * 
         * Avoid scans at any cost by creating more indexes
         * 
         * Can not use both expression and non-expression parameters in the same request: Non-expression parameters: {AttributesToGet} Expression parameters: {FilterExpression, KeyConditionExpression}
         */ 

        
        const params: DynamoDB.DocumentClient.QueryInput = {
            TableName: USERS_TABLE,
            IndexName: USERS_TABLE_USERID_LASTUPDATED_LSI,
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":userId": userId
            },
            ExpressionAttributeNames: {
                "#data": "data"
            },
            ProjectionExpression: "userId, basketId, #data",
            //ScanIndexForward: false,    //false = sort descending, default is true i.e. ascending
            ConsistentRead: false,
        };

        const { Items } = await dynamoDBDocClient.send(new QueryCommand(params));

        const finalItems = Items?.filter(Item =>{
            const { basketId } = Item;
            return basketId != "recentlyViewed";
        });
        try {
            const secretsData = await secretsManager.getSecretValue({SecretId: MY_SECRET_NAME}).promise();
            console.log(`Secret string: ${secretsData}`);
        } catch (error) {
            console.error(error);
        }
        
        const Item = finalItems?.pop();
        if (Item) {
            const { userId, data } = Item;
            res.status(200).json({ userId, data });
        } else {
            res.status(404).json({ error: "Could not find the basket with provided userId and basketId" });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Could not retreive basket" });
    }
});

router.post("/", async function (req: Request, res: Response) {
    try {
        const { basketId, data }: { basketId: string; data: string } = req.body;

        //Request Validation
        if (!basketId) {
            res.status(400).json({ error: "basketId not present" });
        } else if (!data) {
            res.status(400).json({ error: "data not present" });
        }

        let userId = req.cookies["userId"];
        userId = !userId ? crypto.randomUUID() : userId;

        const lastUpdated = new Date().valueOf();

        const expiresAtDate = new Date();
        expiresAtDate.setDate(expiresAtDate.getDate() + 1);
        //Below DynamoDB expiresAt must be in secs
        const expiresAt = Math.round(expiresAtDate.getTime() / 1000);

        const params: DynamoDB.DocumentClient.PutItemInput = {
            TableName: USERS_TABLE,
            Item: {
                userId,
                basketId,
                data,
                lastUpdated,
                expiresAt
            },
        };

        const userCookieExpiresAt= new Date();
        userCookieExpiresAt.setDate(userCookieExpiresAt.getDate() + 365);

        /*
        Dynamo DB Put vs Update, both works like Upsert. Update updates only the attributes passed but Put replaces entire item (i.e. all attributes must be passed) 
        */
        const Item = await dynamoDBDocClient.send(new PutCommand(params));
        console.log(JSON.stringify(Item));
        res.cookie("userId", userId, { httpOnly: true, expires: userCookieExpiresAt });
        res.status(201).json({ basketId });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Could not create user basket" });
    }
});

router.patch("/update-login/:loginId", async function (req: Request, res: Response) {
    try {
        
        const userId = req.cookies["userId"];
        const loginId = req.params.loginId;

        //Request Validation
        if (!userId) {
            res.status(400).json({ error: 'userId not present' });
        } else if (!loginId) {
            res.status(400).json({ error: 'loginId not present' });
        }

        const lastUpdated = new Date().valueOf();

        //In DynamoDB we cannot update multiple items in one update operation, we need to fire them individually for each item

        const queryParams: DynamoDB.DocumentClient.QueryInput = {
            TableName: USERS_TABLE,
            IndexName: USERS_TABLE_USERID_LASTUPDATED_LSI,
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":userId": userId
            },
            ExpressionAttributeNames: {
                "#data": "data"
            },
            ProjectionExpression: "userId, basketId, #data",
            //ScanIndexForward: false,    //false = sort descending, default is true i.e. ascending
            ConsistentRead: false,
        };

        const { Items } = await dynamoDBDocClient.send(new QueryCommand(queryParams));

        if(Items) {
            const updatedBasketIds = await Promise.all(
                Items.map(async Item => {
                    const { userId, basketId } = Item;

                    const params: DynamoDB.DocumentClient.UpdateItemInput = {
                        TableName: USERS_TABLE,
                        Key: {
                            userId,
                            basketId
                        },
                        UpdateExpression: "set loginId = :loginId, lastUpdated = :lastUpdated",
                        ExpressionAttributeValues: {
                            ":loginId": loginId,
                            ":lastUpdated": lastUpdated
                        }
                    };

                    await dynamoDBDocClient.send(new UpdateCommand(params));
                    console.log(basketId);
                    return basketId;
                })
            );
            res.status(200).json({ msg: `Updated ${JSON.stringify(updatedBasketIds)}` });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Could not create user basket" });
    }
});

export = router;