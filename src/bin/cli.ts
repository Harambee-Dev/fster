import { Octokit } from "@octokit/rest";
import execa from "execa";
import inquirer from "inquirer";
import meow from "meow";
import path from "path";
import { GithubDownloader } from "../lib/github-download";
import { ReposGetContentResponseData } from "../types";

const octokit = new Octokit({
  userAgent: "prisma-fast v1.2.3",
  baseUrl: "https://api.github.com",

  log: {
    debug: () => {},
    info: () => {},
    warn: console.warn,
    error: console.error,
  },

  request: {
    agent: undefined,
    fetch: undefined,
    timeout: 0,
  },
});

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
  const found = await loop();
  if (found && found.isExample && found.path) {
    const dir = path.basename(found.path);
    const outputDir = path.join(process.cwd(), argOutputDir ? argOutputDir : dir)
    const gh = new GithubDownloader({
      user: "prisma",
      repo: "prisma-examples",
      path: found.path,
      outputDir,
    });
    gh.on("end", async () => {
      console.log('finished');
      if(cli.flags.setup){
        const installProcess = await execa(`npm`, [ 'install'], { cwd: outputDir, stdio: 'inherit'})
        console.log(`Now run:\n\tcd ${outputDir}`);
      }
    })
    return gh.download();
  }
}
async function loop() {
  let looking = true;
  let currentPath = "";
  while (looking) {
    const result = await recursiveFind(currentPath);
    if (result.isExample) {
      result;
      return result;
    }
    currentPath = currentPath + "/" + result.path;
  }
}
async function recursiveFind(path: string) {
  const response = await octokit.repos.getContent({
    owner: "prisma",
    repo: "prisma-examples",
    path: path,
  });
  // @ts-ignore
  if (response.data.some((item) => item.name === "package.json")) {
    return { path: path, isExample: true };
  }
  // @ts-ignore
  const folders: ReposGetContentResponseData[] = response.data.filter(
    (item: ReposGetContentResponseData) =>
      item.type === "dir" && !item.name.startsWith(".")
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
