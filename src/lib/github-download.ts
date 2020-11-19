import AdmZip from "adm-zip";
import { EventEmitter } from "events";
import fs from "fs-extra";
import path from "path";
import request from "request";
import { ReposGetContentResponseData } from "../types";


interface GithubDownloadParams {
  user: string;
  repo: string;
  path?: string;
  ref?: string;
  outputDir: string;
}
export class GithubDownloader extends EventEmitter {
  user: string;
  repo: string;
  ref: string;
  _log: any[];
  _getZip: boolean;
  pending: number;
  gonnaProcess: number;
  initialUrl: string;
  initialUrlRef: string;
  rawUrl: string;
  path: string;
  outputDir: string;

  constructor(params: GithubDownloadParams) {
    super();
    this.user = params.user;
    this.repo = params.repo;
    this.ref = params.ref ?? 'latest';
    this.outputDir = params.outputDir;
    this._log = [];
    this.path = params.path || "";
    this._getZip = false;
    this.pending = 0;
    this.gonnaProcess = 0;
    this.initialUrl =
      "https://api.github.com/repos/" +
      this.user +
      "/" +
      this.repo +
      "/contents/";
    this.initialUrlRef = this.ref ? `?ref=${this.ref}` : "";
    this.rawUrl = this.rawBuilder(this.user, this.repo, this.ref)
  }
  rawBuilder(user: string, repo: string, ref: string): string { 
    return `https://raw.githubusercontent.com/${this.user}/${this.repo}/${ref}/`
  }
  processItems(items: ReposGetContentResponseData[]) {
    this.pending += items.length;
    this.gonnaProcess -= 1;
    items.forEach((item) => this.handleItem(item));
    this.checkDone();
  }
  urlBuilder(customPath?: string) {
    const url = `${this.initialUrl}${customPath ?? this.path}${
      this.initialUrlRef
    }`;
    // console.log(url);
    return url;
  }
  checkDone() {
    // console.log('PENDING: ' + pending + ' gonnaProcess: ' + gonnaProcess)
    if (this.pending === 0 && this.gonnaProcess === 0 && !this._getZip) {
      this.emit("end");
    }
  }
  download() {
    this.gonnaProcess += 1;
    this.requestJSON();
  }
  extractZip(
    zipFile: string | Buffer | undefined,
    outputDir: string,
    callback: (folderName: string) => void
  ) {
    const zip = new AdmZip(zipFile);
    const entries = zip.getEntries();
    let pending = entries.length;
    const folderName = path.basename(entries[0].entryName);

    const checkDone = (err?: Error) => {
      if (err) this.emit("error", err);
      pending -= 1;
      if (pending === 0) callback(folderName);
    };

    entries.forEach((entry) => {
      if (entry.isDirectory) return this.checkDone();

      const file = path.resolve(outputDir, entry.entryName);
      fs.outputFile(file, entry.getData(), checkDone);
    });
  }
  handleItem(item: ReposGetContentResponseData) {
    // console.log({outputDir: this.outputDir});
    const cleaned = item.path.replace(this.path.substring(1), ``)
    const destinationPath = path.join(this.outputDir, cleaned)
    if (item.type === "dir") {
      fs.mkdirs(destinationPath, (err) => {
        if (err) this.emit("error", err);
        this._log.push(destinationPath);
        this.gonnaProcess += 1;
        this.requestJSON(item.path);
        this.emit("dir", item.path);
        this.pending -= 1;
        this.checkDone();
      });
    } else if (item.type === "file") {
      fs.createFile(destinationPath, (err) => {
        if (err) this.emit("error", err);
        request
          .get(this.rawUrl + item.path)
          .pipe(fs.createWriteStream(destinationPath))
          .on("close", () => {
            this._log.push(destinationPath);
            this.emit("file", item.path);
            this.pending -= 1;
            this.checkDone();
          });
      });
    } else {
      this.emit(
        "Error",
        new Error(JSON.stringify(item, null, 2) + "\n does not have type.")
      );
    }
  }

  downloadZip() {
    if (this._getZip) return;
    this._getZip = true;

    this._log.forEach( (file) => {
      fs.remove(file);
    });

    const tmpdir = process.cwd()
    const zipBaseDir = this.repo + "-" + this.ref;
    const zipFile = path.join(tmpdir, zipBaseDir + ".zip");

    const zipUrl =
      "https://nodeload.github.com/" +
      this.user +
      "/" +
      this.repo +
      "/zip/" +
      this.ref;
    this.emit("zip", zipUrl);

    // console.log(zipUrl)
    fs.mkdir(tmpdir, (err) => {
      if (err) this.emit("error", err);
      request
        .get(zipUrl)
        .pipe(fs.createWriteStream(zipFile))
        .on("close", () => {
          this.extractZip(zipFile, tmpdir, (folderName) => {
            const oldPath = path.join(tmpdir);
            fs.rename(oldPath, this.outputDir, (err) => {
              if (err) this.emit("error", err);
              fs.remove(tmpdir, (err) => {
                if (err) this.emit("error", err);
                this.emit("end");
              });
            });
          });
        });
    });
  }

  requestJSON(customPath?: string) {
    const url = this.urlBuilder(customPath);
    // console.log(url);
    request({ url: url, headers: { 'User-Agent': 'fast/0.0.1' } }, (err, resp, body) => {
      if (err) return this.emit("error", err);
      if (resp.statusCode === 403) return this.downloadZip();
      if (resp.statusCode !== 200)
        this.emit(
          "error",
          new Error(
            url + ": returned " + resp.statusCode + "\n\nbody:\n" + body
          )
        );

      this.processItems(JSON.parse(body));
    });
  }
}

export function download(
  params: GithubDownloadParams,
) {
  const gh = new GithubDownloader(params);
  return gh.download();
}

// PRIVATE METHODS

function generateTempDir() {
  return process.cwd()
}
