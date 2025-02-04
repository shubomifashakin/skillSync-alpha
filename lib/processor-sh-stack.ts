import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";

const region = "us-east-1";

import * as dotenv from "dotenv";

dotenv.config();

export class ProcessorShStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dynamoDb = new Table(this, `matches-sh-dynamo`, {
      tableName: `matches-sh-table`,
      partitionKey: {
        name: "id",
        type: AttributeType.STRING,
      },
      pointInTimeRecovery: true,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    //this ads a globl sec index to the db
    dynamoDb.addGlobalSecondaryIndex({
      partitionKey: {
        name: "user1Id",
        type: AttributeType.STRING,
      },
      indexName: "user1Id-index",
    });

    dynamoDb.addGlobalSecondaryIndex({
      partitionKey: {
        name: "user2Id",
        type: AttributeType.STRING,
      },
      indexName: "user2Id-index",
    });

    //lambda for getting all the apartments
    const scheduleMatchesLambda = new NodejsFunction(
      this,
      `matches-sh-schedule-matches-lambda`,
      {
        functionName: `matches-sh-lambda`,
        memorySize: 1024,

        environment: {
          REGION: region,
          TABLE_NAME: dynamoDb.tableName,
          DATABASE_URL: process.env.DATABASE_URL as string,
        },

        runtime: Runtime.NODEJS_22_X,

        bundling: {
          nodeModules: ["@prisma/client", "prisma"],

          commandHooks: {
            beforeBundling(inputDir: string, outputDir: string): string[] {
              return [];
            },

            beforeInstall(inputDir: string, outputDir: string) {
              //copy the prisma folder to the output directory
              return [`cp -R ${inputDir}/prisma ${outputDir}/`];
            },

            afterBundling(_inputDir: string, outputDir: string) {
              // this goes to the output directory and runs the prisma generate command
              //it also removes the prisma engines and the client node_modules
              return [
                `cd ${outputDir}`,
                `npx prisma generate`,
                `rm -rf node_modules/@prisma/engines`,
                `rm -rf node_modules/@prisma/client/node_modules node_modules/.bin node_modules/prisma`,
              ];
            },
          },
        },

        entry: "./resources/schedule-matches-lambda.ts",
        handler: "handler",
        timeout: cdk.Duration.minutes(15),
      }
    );

    //eventbridge rule trigers the lambda every 10 minutes
    const eventBridgeRule = new Rule(this, "matches-sh-event-bridge-rule", {
      schedule: Schedule.rate(cdk.Duration.minutes(4)), // 🔥 Runs every 10 minutes
      ruleName: "matches-sh-event-bridge-rule",
    });

    //add the eventbridge rule to the lambda
    eventBridgeRule.addTarget(new LambdaFunction(scheduleMatchesLambda));

    //allow the lambda to write to the db
    dynamoDb.grantWriteData(scheduleMatchesLambda);
  }
}
