require("dotenv").config();

import { formatUnits } from "bucket-protocol-sdk";
import { SENTIO_API_KEY, SENTIO_SQL_URL, sleep } from "./utils";
import { getLogger } from "./utils/logger";
import { PrismaClient } from "@prisma/client";
import axios from "axios";

(async () => {

  const logger = getLogger();
  const items = [
    {
      symbol: "SUI",
      table: "SUI"
    },
    {
      symbol: "afSUI",
      table: "AFSUI"
    },
    {
      symbol: "haSUI",
      table: "HASUI"
    },
    {
      symbol: "vSUI",
      table: "VSUI"
    },
    {
      symbol: "USDC",
      table: "USDC"
    },
  ];

  // Loop infinite
  while (true) {
    // Initialize client
    const prisma = new PrismaClient();

    for (const item of items) {
      try {
        // Get last week's tank BUCK amount
        const now = new Date().getTime();
        const lastWeek = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const asset = item.symbol;

        const tank = await prisma.tank.findFirst({
          where: {
            asset,
            createdAt: {
              gt: lastWeek
            },
          },
          orderBy: {
            createdAt: 'asc'
          }
        });
        if (!tank) {
          logger.error(`${asset}: No tank record found`);
          return;
        }

        const LWB = Number(formatUnits(BigInt(tank.buckReserve), 9));

        // Get collateral amount from Sentio
        const { data } = await axios.post(SENTIO_SQL_URL, {
          sqlQuery: {
            sql: `SELECT SUM(collateral_value) as LCW, SUM(amount) as BLW
            FROM ${item.table}_Tank_Liquidation
            WHERE timestamp >= toDateTime(now() - 7 * 24 * 60 * 60);
            `
          }
        }, {
          headers: {
            'Content-Type': 'application/json',
            'api-key': SENTIO_API_KEY,
          }
        });
        const { result: { rows } } = data;
        const LCW = Number(rows[0]['LCW']);
        const BLW = Number(rows[0]['BLW']);

        const apr = (LCW - BLW) * 52 / LWB * 100;
        logger.info(`${asset} - LCW: ${LCW.toFixed(2)}, BLW: ${BLW.toFixed(2)}, LWB: ${LWB.toFixed(2)}, APR: ${apr.toFixed(2)} %`);

        await prisma.apr.create({
          data: {
            apr,
            asset,
          }
        })
      }
      catch (ex: any) {
        if (ex.error) {
          logger.error(`Get error - ${ex.error}`);
        }
        else {
          logger.error(`Get error - ${ex}`);
        }

        // Wait 1 minitue for next run
        await sleep(60 * 1000);
      }
    }

    // Sleep 1 week for next loop
    await sleep(7 * 24 * 60 * 60 * 1000);
  }

})();
