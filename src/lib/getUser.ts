import execa from 'execa';
export async function getCurrentUser() {
  const child = await execa("git", ["config", "-l"]);
  const data = child.stdout.split("\n");
  const [email, name] = [data[0].split("=")[1], data[1].split("=")[1]];
  return {
    name,
    email,
  };
}