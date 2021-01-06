import fg from "fast-glob";
import fs from "fs-jetpack";
import GitUrlParse from "git-url-parse";
import os from "os";
import parse from "parse-git-config";
import path from "path";
import { getCurrentUser } from "./getUser";
import { client } from "./prisma";
const homedir = os.homedir();
const configDir = fs.dir(path.join(homedir, ".config", "fster"));
const configDB = configDir.path("config.db");
if (!fs.exists(configDB)) {
  fs.copy(path.join(__dirname, "..", "..", "config.db"), configDB);
}

export async function sync(currentUser?: { name: string; email: string }) {
  currentUser = currentUser || (await getCurrentUser());


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
        url_path_unique: {
          url: genUrl,
          path: project.projectPath
        }
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
        await client.project.delete({ where: { url_path_unique: { url: p.url, path: p.path} } });
      }
    }
  }
  return client.project.findMany({
    where: { 
      userId: user.id
    }
  })
}
