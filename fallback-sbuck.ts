require("dotenv").config();

import { BucketClient, COIN, SBUCK_BUCK_LP_REGISTRY_ID, TankInfo } from "bucket-protocol-sdk";
import { sleep } from "./utils";
import { getLogger } from "./utils/logger";
import { PrismaClient } from "@prisma/client";

(async () => {
  const logger = getLogger();
  logger.info(`App initialized`);

  // Loop infinite
  const prisma = new PrismaClient();

  while (true) {
    try {
      const bucketClient = new BucketClient();

      // Get sBUCK price
      const prices = await bucketClient.getPrices();
      const suiPrice = prices['SUI'] ?? 1;
      const sBuckPrice = prices['sBUCK'] ?? 1;

      // Get sBUCK apr from on-chain and update db
      const { flowAmount, flowInterval, totalWeight } = await bucketClient.getFountain(SBUCK_BUCK_LP_REGISTRY_ID);
      const rewardAmount = (flowAmount / 10 ** 9 / flowInterval) * 86400000;
      const apr = ((rewardAmount * 365) / ((totalWeight / 10 ** 9) * sBuckPrice)) * suiPrice * 100;

      logger.info(`sBUCK APR: ${apr}%`);

      await prisma.apr.create({
        data: {
          asset: 'sBUCK',
          apr,
        }
      });

      // Sleep 30 seconds for next loop
      await sleep(30 * 1000);
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
