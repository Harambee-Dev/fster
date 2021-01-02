import chalk from "chalk";
import execa from "execa";
import inquirer from "inquirer";
import semver from "semver";
import { spinner } from "./logger";

const update = (
  install: {
    cmd: string;
    args: string[];
  },
  latestVersion: string,
  commandOptions?: execa.SyncOptions<string>
) => {
  const loading = spinner('Updating')
  loading.start()
  try {
    const child = execa.sync(install.cmd, install.args, commandOptions);
    if (child.exitCode <= 0) {
      loading.message(chalk.green(`Successfully updated to version ${latestVersion}`))
    } else {
      loading.message(chalk.red(`Failed to update to version ${latestVersion}`))
    }
  } catch (err) {
    throw new Error(err);
  } finally {
    loading.stop()
  }
};
type Settings = {
  name: string;
  version: string;
  autoupdater?: {
    updateMessage: string;
    check: {
      cmd: string;
      args: string[];
    };
    install: {
      cmd: string;
      args: string[];
    };
    promptUser: boolean;
    commandOptions: execa.SyncOptions<string>;
  };
};
export async function updater({
  name,
  version,
  autoupdater = {
    updateMessage: "Would you like to update now?",
    check: {
      cmd: `npm`,
      args: ["show", name, "version"],
    },
    install: {
      cmd: `npm`,
      args: ["install", "-g", name],
    },
    promptUser: true,
    commandOptions: { timeout: 7000, shell: true },
  },
}: Settings) {
  const result = execa.sync(
    autoupdater.check.cmd,
    autoupdater.check.args,
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
          update(autoupdater.install, latestVersion);
        }
        return answers.shouldUpdate;
      } catch (err) {
        throw new Error(err);
      }
    } else {
      update(autoupdater.install, latestVersion);
      return true;
    }
  } else {
    return false;
  }
}
