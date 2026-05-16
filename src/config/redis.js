import { createClient } from "redis";

/*
* function name: redisClient
* function Description: creates redis connection
* arguments: redisUrl
* return: redis client
*/

const redisClient = async (redisUrl) => {
  const client = createClient({
    url: redisUrl,
  });

  client.on("error", (error) => {
    console.log(error);
  });

  await client.connect();

  console.log("redis connected");

  return client;
};

export default redisClient;