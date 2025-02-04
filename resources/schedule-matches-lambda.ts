import { PrismaClient } from "@prisma/client";
import { shuffleArray } from "../helpers/shuffleArray";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEventV2, Context } from "aws-lambda";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const region = process.env.REGION as string;
const tableName = process.env.TABLE_NAME as string;

const dynamoDb = new DynamoDBClient({ region });
const ddbDocClient = DynamoDBDocumentClient.from(dynamoDb);

const databaseUrl = process.env.DATABASE_URL as string;
const prisma = new PrismaClient();

export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context
) => {
  //get all the users & their profession preferences from the database
  //TODO: FIND A WAY TO REDUCE THE NUMBER OF USERS THAT ARE BEING PROCESSED
  const users = await prisma.users.findMany({
    select: {
      id: true,
      professionId: true,
      UserProfessionPreferences: {
        select: {
          professionId: true,
        },
      },
    },
  });

  //group all users by their profession
  //ALL USERS WITH THE SAME PROFESSION WILL BE GROUPED TOGETHER
  const groupedByProfessions = users.reduce(
    (acc, user) => {
      // if the profession doesn't exist in the object, create it
      if (!acc[user.professionId]) {
        acc[user.professionId] = [];
      }

      // add the user to their profession group
      acc[user.professionId].push({
        userId: user.id,
        usersOwnProfession: user.professionId,
        usersPreferredProfessions: user.UserProfessionPreferences.map(
          (p) => p.professionId
        ),
      });

      return acc;
    },
    {} as {
      [professionId: string]: {
        userId: string;
        usersOwnProfession: string;
        usersPreferredProfessions: string[];
      }[];
    }
  );

  // Shuffle users in each profession group
  Object.values(groupedByProfessions).forEach((professionUsers) => {
    professionUsers = shuffleArray(professionUsers);
  });

  //assign matches to each profession
  const matches: {
    id: string;
    user1Id: string;
    user2Id: string;
    user1ProfessionId: string;
    user2ProfessionId: string;
    ttl: number;
  }[] = [];

  //for each user, loop through their profession preferences and find a user that also wants to work with them
  //TODO: PLEASE SET A LIMIT THAT EACH USER CAN ONLY SELECT UP TO 4 PREFERRED PROFESSIONS
  users.forEach(
    ({
      UserProfessionPreferences: user1ProfessionPreferences,
      id: user1Id,
      professionId: user1ProfessionId,
    }) => {
      //loop through the users profession preferences
      user1ProfessionPreferences.forEach(
        ({ professionId: preferredProfessionId }) => {
          //get all the users in that profession
          const foundProfessionUsers =
            groupedByProfessions[preferredProfessionId];

          //if no users were available for the profession, USER WILL NOT GET ASSIGNED ANY PERSON FOR THAT PROFESSION
          if (!foundProfessionUsers) {
            return;
          }

          //if users were found for that professions, find a user that also wants to work with them
          foundProfessionUsers.forEach(
            ({
              userId: user2Id,
              usersPreferredProfessions: user2PreferredProfessions,
              usersOwnProfession: user2ProfessionId,
            }) => {
              //if a found users has the current user in the loops preferred professions, match them
              //if the found user is the same user, skip
              if (
                user2PreferredProfessions.includes(user1ProfessionId) &&
                user2Id !== user1Id
                //TODO: COME UP WITH A NEW CONSTRAINT TO MAKE SURE THE MATCHES ARE NOT THE SAME USER
              ) {
                matches.push({
                  id: uuidv4(),
                  user1Id: user1Id,
                  user2Id: user2Id,
                  user1ProfessionId: user1ProfessionId,
                  user2ProfessionId: user2ProfessionId,
                  ttl: Math.floor(Date.now() / 1000) + 5 * 60, //5 minutes from now delete the match from the db
                });
              }
            }
          );
        }
      );
    }
  );

  //log the matches and the day it was created
  console.log(new Date().toISOString(), matches);

  //DYNAMO DB ONLY ALLOWS 25 ITEMS PER BATCH WRITE
  // Function to split array into chunks
  const chunkArray = (
    array: {
      user1Id: string;
      user2Id: string;
      user1ProfessionId: string;
      user2ProfessionId: string;
    }[],
    size: number
  ) => {
    const result = [];

    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  };

  //divide the matches into chunks of 25
  const chunks = chunkArray(matches, 25);

  // Process chunks sequentially to respect DynamoDB's 25-item limit
  for (const chunk of chunks) {
    await ddbDocClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((item) => ({
            PutRequest: {
              Item: item,
            },
          })),
        },
      })
    );
  }
};
