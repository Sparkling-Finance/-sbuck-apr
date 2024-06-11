require("dotenv").config();

import { BucketClient, COIN, TankInfo } from "bucket-protocol-sdk";
import { sleep } from "./utils";
import { getLogger } from "./utils/logger";
import { PrismaClient } from "@prisma/client";

(async () => {
  const logger = getLogger();
  logger.info(`App initialized`);

  // Loop infinite
  const prisma = new PrismaClient();
  const bucketClient = new BucketClient();

  while (true) {
    try {
      // Get tank information from on-chain and update db
      const records = [];
      const tanks = await bucketClient.getAllTanks();
      for (const asset in tanks) {
        const { buckReserve, collateralPool, currentP, currentS } = tanks[asset as COIN] as TankInfo;
        records.push({
          asset,
          buckReserve,
          collateralPool,
          currentP,
          currentS,
        });
      }

      await prisma.tank.createMany({
        data: records
      });

      logger.info(`${records.length} tank records inserted`);

      // Sleep 10 minitues for next loop
      await sleep(10 * 60 * 1000);
    }
    catch (ex: any) {
      if (ex.error) {
        logger.error(`Get error while loop - ${ex.error}`);
      }
      else {
        logger.error(`Get error while loop - ${ex}`);
      }

      // Wait 1 minitue for next run
      await sleep(60 * 1000);
    }
  }

})();
