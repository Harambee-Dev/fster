import chalk from "chalk";
import execa from "execa";
import inquirer from "inquirer";
import meow from "meow";
import path from "path";
import { ExampleRepo, EXAMPLE_REPOS } from "../examples";
import { fetchContent, GithubDownloader } from "../lib/github-download";

async function run() {
  const cli = meow(
    `
  Usage
    $ npx @harambee/fast <dest> <...options>
      
      dest     (optional) Directory to output to

      options
        -(-s)etup         Runs npm install 
`,
    {
      autoHelp: true,
      flags: {
        help: {
          alias: "h",
          type: "boolean",
        },
        setup: {
          alias: "s",
          type: "boolean",
        },
      },
    }
  );
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
