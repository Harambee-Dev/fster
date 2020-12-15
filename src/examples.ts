export interface ExampleRepo {
  user: string;
  repo: string;
  initialPath: string;
  defaultRef: string;
}
export const EXAMPLE_REPOS: Record<string, ExampleRepo> = {
  "prisma" : {
    user: "prisma",
    repo: "prisma-examples",
    initialPath: "",
    defaultRef: "latest",
  },
  "vercel" : {
    user: "vercel",
    repo: "vercel",
    initialPath: "examples",
    defaultRef: "master",
  },
  "williamluke4" : {
    user: "williamluke4",
    repo: "templates",
    initialPath: "",
    defaultRef: "main",
  },
}
