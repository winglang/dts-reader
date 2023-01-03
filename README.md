# dts-reader

> Reads a TypeScript type definition file and generates a JSON representation of the API.

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

## TOD

## License

Licensed under the [MIT License](./LICENSE).