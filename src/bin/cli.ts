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
import { READMD_REGEX } from "../lib/markdown";
import { checkSetup, client, Settings } from "../lib/prisma";
import { sync } from "../lib/sync";
import { updater } from "../lib/update";
import ci from 'ci-info'


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
  await checkSetup()
  if (!ci.isCI && pkg.version && pkg.name && !pkg.version.includes('next')) {
    let updated = false
    try {
      updated = await updater({ name: pkg.name, version: pkg.version });
    } catch {
      // No Internet Connection or ..
    }
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
      organize            {dim Organize all Git Projects (Not Implemented) }
      template <dest>     {dim Select a Template to Download, Install and Open}
      
      
    {bold Options}
      -(-v)ersion         {dim Display Version  }
      -(-s)ync            {dim Synchronize Local Projects  }
      -(-h)elp            {dim Display this  }
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
        sync: {
          alias: "s",
          type: "boolean",
        },
      },
    }
  );

  if (cli.input[0] === "organize") {

  }
  if (!cli.input[0] || cli.input[0] === "local") {
    let synced = false
    let projects = await client.project.findMany();
    if(projects.length <= 0 || cli.flags.sync){
      projects = await logger.run('Synchronizing Projects', sync(currentUser), 'Synchronized') ?? []
      synced = true
    }
    // const argOutputDir = cli.input[0];
    const { repo } = await inquirer.prompt([
      {
        type: "autocomplete",
        name: "repo",
        required: true,
        message: "What would you like to Open?",
        pageSize: 10,
        source: (answers: any, input: string) => {
        const maxPLength = projects.reduce((acc, p) => {
          const full = p.name ?? ''
          if(full.length > acc) return full.length
          return acc
        }, 0)
        return search(projects, (p) => {
            const parentDir = path.basename(p.path)
            const parentParentDir = path.basename(path.join(p.path, '..'))
            const projectPath = `${parentParentDir}/${parentDir}`
            if(currentUser.settings?.displayFolders){
              return `${p.name}${` `.repeat(maxPLength - (p.name?.length || 0))} ${chalk.dim(projectPath)}` ?? "None"
            }
            return `${p.name}` ?? "None"
          }, input)
        }
      },
    ]);
    const selectedRepo = currentUser.settings?.displayFolders ? repo.split(' ')[0] : repo
    const project = projects.find((p) => p.name === selectedRepo);
    if (currentUser?.settings?.editor && project?.path) {
      if (fs.exists(project.path)) {
        execa(currentUser.settings?.editor ?? "code", [project.path]);
      } else {
        logger.error(`Project path no longer exists, please rerun`);
        await client.project.delete({
          where: {
            url_path_unique: {
              path: project.path,
              url: project.url 
            }
          },
        });
      }
    }
    if(!synced){
      projects = await sync(currentUser)
      synced = true
    }
  }
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
        const file = mdFiles.find((f) => READMD_REGEX.exec(f));
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
        const openInEditor = await logger.confirm(
          `Would you like open this project using ${chalk.inverse(
            ` ${currentUser.settings?.editor} `
          )}`
        )
        if (file && openInEditor) {
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
  if (cli.input[0] === "settings") {
    if (!currentUser) throw new Error("No User Found");
    const settings: Partial<Settings> = {
      packageManager: currentUser.settings?.packageManager ?? "yarn",
      editor: currentUser.settings?.editor ?? "code",
      displayFolders: currentUser.settings?.displayFolders ?? false,
    };
    printSettings(currentUser.settings);
    // const argOutputDir = cli.input[0];
    const answers = await inquirer.prompt(
      Object.keys(settings).map((key) => ({
        type: typeof settings[key as keyof Settings] === "string" ? 'input' : 'confirm',
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
            displayFolders: answers.displayFolders
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
