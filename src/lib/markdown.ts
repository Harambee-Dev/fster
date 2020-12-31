// Create reference instance
import chalk from 'chalk';
import marked from 'marked';
import fs from 'fs-extra';
import { path } from 'fs-jetpack';
import terminalLink from 'terminal-link';
import indentString from 'indent-string';
let lev = 0
// Override function
const renderer: marked.Renderer = {
  heading(text, level) {
    lev= level
    return indentString(chalk.underline.bold(`\n ${text}\n`), lev - 1)
  },
  blockquote(quote){
    return chalk.inverse(`${quote}`)
  },
  br(){
    return `\n`
  },
  checkbox(check){
    return  check ? `✔️` : `[ ]`
  },
  code(code, lang){
    return indentString(`\n${chalk.dim(code)}\n`, lev)
  },
  codespan(quote){
    return chalk.inverse.dim(` ${quote} `)
  },
  del(quote){
    return ``
  },
  em(quote){
    return ``
  },
  html(quote){
    return ``
  },
  image(quote){
    return ``
  },
  link(href, title, text){
    return terminalLink(text, href || '', {
      fallback: () => chalk`{bold ${text}} {dim ${href}}`
    })
  },
  list(body, ordered, start){
    return indentString(body, lev + 1)
  },
  listitem(quote){
    return indentString(`- ${quote}\n`, lev + 1)
  },
  paragraph(text){
    return indentString(`\n${text}\n`, lev)
  },
  strong(text){
    return chalk.bold(text)
  },
  table(quote){
    return ``
  },
  tablecell(){
    return ``
  },
  hr(){
    return ``
  },
  tablerow(quote){
    return ``
  },
  text(text){
    return `${text}`
  },
  options: {

  }

};

marked.use({ renderer });

// Run marked

interface FileOptions {
  path: string
}
export const MD_REGEX = /read/i
export function printMD(data: FileOptions | string) {
  if(typeof data === 'string'){
    console.log(marked(data));
  } else {
    const raw = fs.readFileSync(data.path, {encoding: 'utf8'})
    console.log(marked(raw));
  }
}