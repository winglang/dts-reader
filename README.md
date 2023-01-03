# dts-reader

> Reads a TypeScript type definition file and generates a JSON representation of the API.

**STATUS**: this is a prototype, and not fully implemented. This means that there might be modules
that cannot be read and type information that might not be included in the output.

We should look into https://ts-morph.com/ as an alternative way to read typescript definitions.

## Usage

Clone the repo:

```sh
git clone git@github.com:winglang/dts-reader.git
cd dts-reader
```

Build:

```sh
npm install
npm run build
```

Run:

```sh
bin/dts-reader node_modules/@types/json-schema/index.d.ts
.output/json-schema.types.json
```

The file `.output/json-schema.types.json` now includes a JSON representation of the types exported
by the `json-schema` module.

## Contributing

All contributions are celebrated. We follow the [CNCF Code of
Conduct](https://github.com/cncf/foundation/blob/main/code-of-conduct.md).

We hang out on [Wing Slack](https://t.winglang.io/slack).

## License

Licensed under the [MIT License](./LICENSE).
