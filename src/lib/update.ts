import execa from "execa";

const semver = require("semver");
const inquirer = require("inquirer");
const chalk = require("chalk");

const update = (
  command: string,
  latestVersion: string,
  commandOptions?: execa.SyncOptions<string>
) => {
  console.log(chalk.blue("Updating..."));
  if (execa.sync(command, [], commandOptions).exitCode <= 0) {
    console.log(
      chalk.green(`Successfully updated to version ${latestVersion}`)
    );
  } else {
    console.log(chalk.red(`Failed to update to version ${latestVersion}`));
  }
};
type Settings = {
  name: string;
  version: string;
  autoupdater?: {
    updateMessage: string;
    checkCommand: string;
    installCommand: string;
    promptUser: boolean;
    commandOptions: execa.SyncOptions<string>;
  };
};
export async function updater({
  name,
  version,
  autoupdater = {
    updateMessage: "Would you like to update now?",
    checkCommand: `npm show ${name} version`,
    installCommand: `npm install -g ${name}`,
    promptUser: true,
    commandOptions: { timeout: 7000, shell: true },
  },
}: Settings){
  const result = execa.sync(
    autoupdater.checkCommand,
    [],
    autoupdater.commandOptions
  );

  if (!result || result.stderr) {
    throw new Error(result ? result.stderr.trim() : "Command did not complete");
  }

  const latestVersion = result.stdout.trim();

  if (semver.gt(latestVersion, version)) {
    console.log(chalk.yellow(`New version available: ${latestVersion}`));
    if (autoupdater.promptUser) {
      // If we should prompt
      try {
        const answers = await inquirer.prompt({
          name: "shouldUpdate",
          message: autoupdater.updateMessage,
          type: "confirm",
          default: true,
        });
        if (answers.shouldUpdate === true) {
          update(autoupdater.installCommand, latestVersion);
        }
        return answers.shouldUpdate;
      } catch (err) {
        throw new Error(err);
      }
    } else {
      update(autoupdater.installCommand, latestVersion);
      return true;
    }
  } else {
    return false;
  }
};
