import chalk from "chalk";
import execa from "execa";
import inquirer from "inquirer";
import meow from "meow";
import path from "path";
import { ExampleRepo, EXAMPLE_REPOS } from "../examples";
import { fetchContent, GithubDownloader } from "../lib/github-download";
import { PrismaClient, Settings } from "../../client";
import fg from "fast-glob";
import fs from "fs-jetpack";
import fuzzy from "fuzzy";
import GitUrlParse from "git-url-parse";
import os from "os";
import parse from "parse-git-config";
import { updater } from "../lib/update";
const homedir = os.homedir();
const configDir = fs.dir(path.join(homedir, '.config', 'fster'))
const configDB = configDir.path('config.db')
if(!fs.exists(configDB)){
  fs.copy(path.join(__dirname, '..', '..', 'config.db'), configDB)
}
process.env.DATABASE_URL = `file:${configDB}`

const client = new PrismaClient({
  // log:['error', 'info', 'warn', 'query']
});
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);
function printSettings(settings: Settings | null, updated?: boolean) {
  console.log(chalk.bold(`\n  ${updated ? 'Updated ': ''}Settings`));
  settings &&
    Object.keys(settings).forEach((key) => {
      if (!["id", "userId"].includes(key)) {
        // @ts-ignore
        console.log(`    ${key}: ${chalk.gray(settings[key])}`);
      }
    });
  console.log("\n");
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
async function getCurrentUser() {
  const child = await execa("git", ["config", "-l"]);
  const data = child.stdout.split("\n");
  const [email, name] = [data[0].split("=")[1], data[1].split("=")[1]];
  return {
    name,
    email,
  };
}
const pkg = fs.read(path.join(__dirname,"..","..", "package.json"), "json")
async function run() {
  const updated = await updater({name: pkg.name, version: pkg.version})
  if(updated){
    console.log('You may now rerun the last command');
    process.exit();
  }
  const currentUser = await getCurrentUser();

  const cli = meow(
    chalk`
    {bold Usage}
    {dim \$} fster  {dim <command>}  {dim <...options>}

    {bold Commands}
      sync                {dim Sync all local git projects}
      local               {dim Open a local git project}
      settings            {dim Edit your settings }
      template <dest>     {dim Select a Template to download}
      
      
    {bold Options}
      --sync              {dim Sync all local git projects  }
      -(-s)etup           (template) {dim Runs install after download }
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
        setup: {
          alias: "s",
          type: "boolean",
        },
        sync: {
          type: "boolean",
        },
      },
    }
  );
  if(cli.input[0] === 'template'){
    const argOutputDir = cli.input[0];
    const { who } = await inquirer.prompt([
      {
        type: "list",
        name: "who",
        required: true,
        default: 'prisma',
        message: "Who's examples are you looking for",
        pageSize: Object.keys(EXAMPLE_REPOS).length,
        choices: Object.keys(EXAMPLE_REPOS),
      },
    ]);
    const examples = EXAMPLE_REPOS[who as keyof typeof EXAMPLE_REPOS]
    const found = await loop(examples);
  
    if (found && found.isExample && found.path) {
      const dir = path.basename(found.path);
      const outputDir = path.join(
        process.cwd(),
        argOutputDir ? argOutputDir : dir
      );
      const gh = new GithubDownloader({
        user: examples.user,
        repo: examples.repo,
        path: found.path,
        ref: examples.defaultRef,
        outputDir,
      });
      gh.on("end", async () => {
        console.log(`${chalk.green("✓")} Downloaded`);
        if (cli.flags.setup) {
          const installProcess = await execa(`npm`, ["install"], {
            cwd: outputDir,
            stdio: "inherit",
          });
          console.log(`${chalk.green("✓")} Packages Installed`);
        }
        console.log(`${chalk.green("✓")} Complete`);
        let getStarted = `\n${chalk.bold("To get started run")}:\n`
        getStarted += `  cd ${path.relative(process.cwd(), outputDir)}\n`
        if(!cli.flags.setup){
          getStarted += "  npm i" 
        }
        console.log(getStarted);
      });
      return gh.download();
    }
  }
  if (cli.input[0] === "sync" || cli.flags.sync) {
    const user = await client.user.upsert({
      create: {
        email: currentUser.email,
        name: currentUser.name,
        settings: {
          create: {},
        },
      },
      update: {},
      where: {
        email: currentUser.email,
      },
    });
    const locations = fg.sync([path.join(homedir, "**", ".git")], {
      onlyDirectories: true,
      suppressErrors: true,
      deep: 6,
      ignore: ["**/node_modules/**"],
    });
    for (const location of locations) {
      const git = await parse({
        path: ".git/config",
        cwd: path.dirname(location),
      });
      const urls = git
        ? (Object.keys(git).reduce((acc, key) => {
            if (key.startsWith("remote")) {
              // @ts-ignore
              acc.push(git[key].url);
            }
            return acc;
          }, []) as string[])
        : [];
      const url = urls[0] ? GitUrlParse(urls[0]) : null;
      const project = {
        folderName: path.basename(path.dirname(location)),
        projectPath: path.dirname(location),
        urls,
        git,
      };
      const genUrl = urls[0] ?? `scratchpad/${project.folderName}`;
      if (genUrl) {
      }
      await client.project.upsert({
        create: {
          name: url?.full_name ?? `scratchpad/${project.folderName}`,
          path: project.projectPath,
          user: { connect: { email: user.email } },
          url: genUrl,
        },
        update: {
          name: url?.full_name ?? `scratchpad/${project.folderName}`,
          path: project.projectPath,
          user: { connect: { email: user.email } },
        },
        where: {
          url: genUrl,
        },
      });
    }
    const usr = await client.user.findUnique({
      where: { email: user.email },
      include: { projects: true },
    });
    if (usr?.projects) {
      for (const p of usr?.projects) {
        if (!fs.exists(p.path)) {
          await client.project.delete({ where: { url: p.url } });
        }
      }
    }
    console.log("Local Projects Synced");
  }
  const user = await client.user.findUnique({
    where: { email: currentUser.email },
    include: { settings: true },
  });
  if (cli.input[0] === "local") {
    const projects = await client.project.findMany();
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
    if (user?.settings?.editor && project?.path) {
      if (fs.exists(project.path)) {
        execa(user.settings?.editor ?? "code", [project.path]);
      } else {
        console.error(
          `${chalk.redBright(
            "Error"
          )} Project path no longer exists, please resync`
        );
        await client.project.delete({
          where: {
            url: project.url,
          },
        });
      }
    }
  }
  if (cli.input[0] === "settings") {
    if (!user) throw new Error("No User Found");
    const settings = {
      packageManager: user.settings?.packageManager ?? "yarn",
      editor: user.settings?.editor ?? "code",
    };
    printSettings(user.settings);
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
