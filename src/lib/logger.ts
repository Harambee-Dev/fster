import chalk from "chalk";
import inquirer from 'inquirer'
import CLI from 'clui'
export const tags = {
  error: chalk.red('ⲭ'),
  warn: chalk.yellow('❢'),
  info: chalk.blue('𝒊'),
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


export const spinner = (action: string) =>  new CLI.Spinner(action, ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'])

export async function run<T>(action: string, callback: Promise<T>) {
  let countdown = new CLI.Spinner(action, ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'])
  try {
    countdown.start()
    const value = await callback
    countdown.stop();
    success(action)
    return value
  } catch (reason){
    countdown.stop();
    error(action)
    log(reason)
    await shouldContinue()
  } 
}
export async function shouldContinue() {
  const yes = await confirm('Do You Want To Continue')
  if (yes) {
    log(`Continuing`)
  } else {
    process.exit(1)
  }
}

export async function confirm(value: string) {
  const answer = await inquirer.prompt({
    type: 'confirm',
    message: value,
    name: 'confirm',
  })
  return answer.confirm
}
export default {
  spinner,
  log,
  warn,
  success,
  info,
  error,
  confirm, 
  shouldContinue,
  run
}
