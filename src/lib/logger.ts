import chalk from "chalk";

export const tags = {
  error: chalk.red('error(fster)'),
  warn: chalk.yellow('warn(fster)'),
  info: chalk.blue('info(fster)'),
  success: chalk.green("✓")
}

export function log(...data: any[]) {
  console.log(...data);
}
export function warn(message: any, ...optionalParams: any[]) {
  console.warn(`${tags.warn} ${message}`, ...optionalParams);
}
export function success(message: any, ...optionalParams: any[]) {
  console.log(`${tags.success} ${message}`, ...optionalParams);
}
export function info(message: any, ...optionalParams: any[]) {
  console.info(`${tags.info} ${message}`, ...optionalParams);
}
export function error(message: any, ...optionalParams: any[]) {
  console.error(`${tags.error} ${message}`, ...optionalParams);
} 
export default {
  log,
  warn,
  success,
  info,
  error
}
