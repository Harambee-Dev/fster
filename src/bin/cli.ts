import { Octokit } from "@octokit/rest";
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
    $ npx @williamluke4/fast 
`,
    {
      autoHelp: true,
      flags: {
        help: {
          alias: "h",
          type: "boolean",
        },
      },
    }
  );

  const outputDir = cli.input[0];
  const found = await loop();
  if (found && found.isExample && found.path) {
    const dir = path.basename(found.path);
    const gh = new GithubDownloader({
      user: "prisma",
      repo: "prisma-examples",
      path: found.path,
      outputDir: path.join(process.cwd(), outputDir ? outputDir : dir),
    });
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
interface Item {
  name: string;
  path: string;
  link?: string;
  isDir: boolean;
}
async function getAllUrls(path: string) {
  const response = await octokit.repos.getContent({
    owner: "prisma",
    repo: "prisma-examples",
    path: path,
  });
  let files: Item[] = [];
  // @ts-ignore
  const data = split(path, response.data);
  files.push(...data.files);
  if (data.folders.length > 0) {
    for (const folder of data.folders) {
      const sub = await getAllUrls(folder.path);
      files.push(...sub);
    }
  }
  return files;
}
function split(path: string, items: ReposGetContentResponseData[]) {
  return items.reduce(
    (acc, item) => {
      if (item.type === "dir") {
        acc.folders.push({
          isDir: true,
          name: item.name,
          path: path + "/" + item.name,
        });
      } else {
        acc.files.push({
          isDir: false,
          name: item.name,
          path: path + "/" + item.name,
        });
      }
      return acc;
    },
    { files: [], folders: [] } as { files: Item[]; folders: Item[] }
  );
}
module.exports = {
  run: run,
};
