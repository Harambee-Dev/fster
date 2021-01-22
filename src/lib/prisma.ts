import path from "path";
import { PrismaClient } from "../../client";
import fs from "fs-jetpack";
import os from "os";
const homedir = os.homedir();
const configDir = fs.dir(path.join(homedir, '.config', 'fster'))
const configDB = configDir.path('config.db')
if(!fs.exists(configDB)){
  fs.copy(path.join(__dirname, '..', '..', 'config.db'), configDB)
}

process.env.DATABASE_URL = `file:${configDB}`


export const client = new PrismaClient({
  // log:['error', 'info', 'warn', 'query']
});
export * from '../../client'