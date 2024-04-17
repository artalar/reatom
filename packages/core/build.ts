import dts from 'bun-plugin-dts'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './build',
  plugins: [
    dts()
  ],
})

//    "build": "microbundle -f esm,cjs --raw=true",
