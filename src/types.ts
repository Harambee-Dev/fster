export interface ReposGetContentResponseData {
  type: string;
  encoding: string;
  size: number;
  name: string;
  path: string;
  content: string;
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
  download_url: string;
  target: string;
  submodule_git_url: string;
  _links: {
      git: string;
      self: string;
      html: string;
  };
}