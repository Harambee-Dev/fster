import execa from 'execa';
import { client } from './prisma';
export async function getCurrentUser() {
  const child = await execa("git", ["config", "-l"]);
  const data = child.stdout.split("\n");
  const [email, name] = [data[0].split("=")[1], data[1].split("=")[1]];
  let usr = await client.user.findUnique({
    where: { email: email },
    include: { projects: true,settings: true },
  });
  if(!usr){
    usr = await client.user.create({
      data: { 
        name, email, settings : {
          create: {}
        }
      },
      include: { projects: true, settings: true}
    })
  }
  return usr
}