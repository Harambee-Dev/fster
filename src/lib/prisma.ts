import path from "path";
import { PrismaClient } from "../../client";
import fs from "fs-jetpack";
import os from "os";
import logger from "./logger";

const homedir = os.homedir();
const configDir = fs.dir(path.join(homedir, '.config', 'fster'))
const configDB = configDir.path('config.db')
const baseDBPath = path.join(__dirname, '..', '..', 'config.db')
export async function checkSetup(){
  if(!fs.exists(configDB)){
    logger.warn('No Local DB trying to copy base')
    const spin = logger.spinner(`copying base from ${baseDBPath} -> ${configDB}`)
    spin.start()
    try {
      fs.copy(baseDBPath, configDB)
    } catch (err) {
      spin.stop()
      logger.error(err)
      process.exit(1)
    }
    spin.message("Copied Based Successfully")
    spin.stop()
  }
}
export const client = new PrismaClient({
  datasources: {
    db: {
      url: `file:${configDB}`,
    }
  }
});
export * from '../../client'