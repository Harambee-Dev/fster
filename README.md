# Fast

Make things _fast_, Break things _fast_, Learn things _fast_

[![asciicast](https://asciinema.org/a/xePnK15lBD36vd2IXD0HasrjI.svg)](https://asciinema.org/a/xePnK15lBD36vd2IXD0HasrjI)

![npm](https://img.shields.io/npm/v/@harambee/fast?style=flat-square)

## Usage

```shell
$ npx @harambee/fast <dest> <...options>

$ yarn global add @harambee/fast

$ npm i -g @harambee/fast
```

### Global Usage

```shell
$ fast <dest> <...options>
```

### Options

```shell
  dest     (optional) Directory to output to
```

```shell
Options
  -(-s)etup         Runs npm install
```

## Supported Examples

- Prisma
- Vercel

To add more just edit [examples.ts](./src/examples.ts)

## Development

```shell
git clone https://github.com/Harambee-Dev/fast.git
cd codemods
yarn && yarn watch
```

In a separate terminal you can then run

```shell
yarn cli --help
```

### Testing

```shell
yarn test
```
