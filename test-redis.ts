import "dotenv/config";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  tls: {},
});

async function test() {
  try {
    const pong = await redis.ping();
    console.log("Ping:", pong);

    await redis.set("test", "hello", "EX", 60);
    const value = await redis.get("test");
    console.log("Value:", value);

    await redis.del("test");
    console.log("Redis working ✅");
    process.exit(0);
  } catch (err) {
    console.error("Redis failed ❌", err);
    process.exit(1);
  }
}

test();