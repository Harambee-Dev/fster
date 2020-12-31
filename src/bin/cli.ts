import chalk from "chalk";
import execa from "execa";
import fs from "fs-jetpack";
import fuzzy from "fuzzy";
import indentString from "indent-string";
import inquirer from "inquirer";
import meow from "meow";
import os from "os";
import path from "path";
import type { PackageJson } from "types-package-json";
import { ExampleRepo, EXAMPLE_REPOS } from "../examples";
import { getCurrentUser } from "../lib/getUser";
import { fetchContent, GithubDownloader } from "../lib/github-download";
import logger, { spinner } from "../lib/logger";
import { MD_REGEX } from "../lib/markdown";
import { client, Settings } from "../lib/prisma";
import { sync } from "../lib/sync";
import { updater } from "../lib/update";

const homedir = os.homedir();
const configDir = fs.dir(path.join(homedir, ".config", "fster"));
const configDB = configDir.path("config.db");
if (!fs.exists(configDB)) {
  fs.copy(path.join(__dirname, "..", "..", "config.db"), configDB);
}

inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);
function printSettings(settings: Settings | null, updated?: boolean) {
  logger.log(chalk.bold(`\n  ${updated ? "Updated " : ""}Settings`));
  settings &&
    Object.keys(settings).forEach((key) => {
      if (!["id", "userId"].includes(key)) {
        // @ts-ignore
        logger.log(`    ${key}: ${chalk.gray(settings[key])}`);
      }
    });
  logger.log("\n");
}
function search<T>(search: T[], getter: (value: T) => string, input: string) {
  input = input || "";
  const values = search.map(getter);
  return new Promise(function (resolve) {
    var fuzzyResult = fuzzy.filter(input, values);
    const results = fuzzyResult.map(function (el) {
      return el.original;
    });
    resolve(results);
  });
}

const pkg = fs.read(
  path.join(__dirname, "..", "..", "package.json"),
  "json"
) as Partial<PackageJson>;
async function run() {
  if (pkg.version && pkg.name && !pkg.name.includes('dev')) {
    const updated = await updater({ name: pkg.name, version: pkg.version });
    if (updated) {
      logger.success("You may now rerun the last command");
      process.exit();
    }
  }
  const currentUser = await getCurrentUser();

  const cli = meow(
    chalk`
    {bold Usage}
    {dim \$} fster  {dim <command>}  {dim <...options>}

    {bold Commands}
      local               {dim Open a local git project}
      settings            {dim Edit your settings }
      template <dest>     {dim Select a Template to Download, Install and Open}
      
      
    {bold Options}
      -(-v)ersion         {dim Display Version  }
`,
    {
      autoHelp: true,
      flags: {
        help: {
          alias: "h",
          type: "boolean",
        },
        version: {
          alias: "v",
          type: "boolean",
        },
      },
    }
  );

  if (cli.input[0] === "template") {
    const argOutputDir = cli.input[1];
    const { who } = await inquirer.prompt([
      {
        type: "list",
        name: "who",
        required: true,
        default: "prisma",
        message: "Who's examples are you looking for",
        pageSize: Object.keys(EXAMPLE_REPOS).length,
        choices: Object.keys(EXAMPLE_REPOS),
      },
    ]);
    const examples = EXAMPLE_REPOS[who as keyof typeof EXAMPLE_REPOS];
    const found = await loop(examples);

    if (found && found.isExample && found.path) {
      const dir = path.basename(found.path);
      const outputDir = path.join(
        process.cwd(),
        argOutputDir ? argOutputDir : dir
      );
      const spin = spinner("Downloading");
      spin.start();
      const gh = new GithubDownloader({
        user: examples.user,
        repo: examples.repo,
        path: found.path,
        ref: examples.defaultRef,
        outputDir,
      });
      gh.on("end", async () => {
        spin.stop();
        // Install Deps
        const pkgMnger = currentUser?.settings?.packageManager ?? "npm";
        const pkgMngerArgs = pkgMnger === "npm" ? ["install"] : [];
        await logger.run(
          "Installing",
          execa(pkgMnger, pkgMngerArgs, {
            cwd: outputDir,
            stdio: "ignore",
          })
        );

        // Clean Git
        await logger.run(
          "Cleaning git",
          execa(`rm`, ["-rf", "./.git"], {
            cwd: outputDir,
            stdio: "ignore",
          })
        );
        // New git
        await logger.run(
          "Initializing git",
          execa(`git`, ["init"], {
            cwd: outputDir,
            stdio: "ignore",
          })
        );
        // Add git
        await logger.run(
          "Adding files to git",
          execa(`git`, ["add", "."], {
            cwd: outputDir,
            stdio: "ignore",
          })
        );
        // Commit
        const commitMessage = `"fster(template): https://github.com/${examples.user}/${examples.repo}/tree/${examples.defaultRef}${found.path}"`;
        await logger.run(
          `Added commit - ${commitMessage}`,
          execa(`git`, ["commit", "-m", commitMessage], {
            cwd: outputDir,
            stdio: "ignore",
          })
        );
        const mdFiles = fs.find({
          files: true,
          directories: false,
          ignoreCase: true,
          matching: "*.md",
        });
        const file = mdFiles.find((f) => MD_REGEX.exec(f));
        const parsed = fs.read(path.join(outputDir, "package.json"), "json");

        if (parsed && parsed.scripts) {
          const longest = Object.keys(parsed.scripts).reduce(
            (longest, name) => (name.length > longest ? name.length : longest),
            0
          );
          const display = Object.keys(parsed.scripts).reduce((acc, name) => {
            const space = longest - name.length;
            acc += `${" ".repeat(space / 2)}${chalk.inverse(
              ` ${name} `
            )}${" ".repeat(space / 2)}  ${chalk.dim(parsed.scripts[name])}\n`;
            return acc;
          }, "\n");
          logger.log(chalk.bold.underline("\nScripts"));
          logger.log(indentString(display, 2));
        }
        if (
          file &&
          (await logger.confirm(
            `Would you like open this project using ${chalk.inverse(
              ` ${currentUser.settings?.editor} `
            )}`
          ))
        ) {
          // printMD({ path: file });
          // Open In Editor
          const editorProcess = execa(
            currentUser?.settings?.editor ?? "code",
            ["."],
            {
              cwd: outputDir,
              detached: true,
              stdio: "ignore",
            }
          );
          editorProcess.unref();
        }
      });
      gh.download();
    }
  }
  if (cli.input[0] === "local") {
    let projects = await client.project.findMany();
    sync(currentUser).then((prjs) => {
      projects = prjs;
    });
    // const argOutputDir = cli.input[0];
    const { repo } = await inquirer.prompt([
      {
        type: "autocomplete",
        name: "repo",
        required: true,
        message: "What would you like to Open?",
        pageSize: 10,
        source: (answers: any, input: string) =>
          search(projects, (p) => p.name ?? "None", input),
      },
    ]);
    const project = projects.find((p) => p.name === repo);
    if (currentUser?.settings?.editor && project?.path) {
      if (fs.exists(project.path)) {
        execa(currentUser.settings?.editor ?? "code", [project.path]);
      } else {
        logger.error(`Project path no longer exists, please rerun`);
        await client.project.delete({
          where: {
            url: project.url,
          },
        });
      }
    }
  }
  if (cli.input[0] === "settings") {
    if (!currentUser) throw new Error("No User Found");
    const settings = {
      packageManager: currentUser.settings?.packageManager ?? "yarn",
      editor: currentUser.settings?.editor ?? "code",
    };
    printSettings(currentUser.settings);
    // const argOutputDir = cli.input[0];
    const answers = await inquirer.prompt(
      Object.keys(settings).map((key) => ({
        type: "input",
        name: key,
        required: true,
        // @ts-ignore
        default: settings[key],
        message: `What ${key} would you like to use?`,
      }))
    );
    const updatedUser = await client.user.update({
      data: {
        settings: {
          update: {
            editor: answers.editor,
            packageManager: answers.packageManager,
          },
        },
      },
      where: {
        email: currentUser.email,
      },
      include: {
        settings: true,
      },
    });
    printSettings(updatedUser.settings, true);
  }
  client.$disconnect();
}

async function loop(config: ExampleRepo) {
  let looking = true;
  let currentPath = config.initialPath;
  while (looking) {
    const result = await recursiveFind(config, currentPath);
    if (result.isExample) {
      result;
      return result;
    }
    currentPath = currentPath + "/" + result.path;
  }
}
async function recursiveFind(config: ExampleRepo, path: string) {
  const response = await fetchContent({
    user: config.user,
    repo: config.repo,
    ref: config.defaultRef,
    path: path,
  });
  if (response.some((item) => item.name === "package.json")) {
    return { path: path, isExample: true };
  }
  const folders = response.filter(
    (item) => item.type === "dir" && !item.name.startsWith(".")
  );

  const category_choices = folders.reduce((acc, value) => {
    acc.push({
      name: value.name,
      value: `${value.name}`,
    });
    return acc;
  }, [] as { name: string; value: string }[]);

  const { category } = await inquirer.prompt([
    {
      type: "list",
      name: "category",
      required: true,
      message: "Which Category would you like",
      pageSize: category_choices.length,
      choices: category_choices,
    },
  ]);
  // console.log(category);
  return { path: category, isExample: false };
}

module.exports = {
  run: run,
};
