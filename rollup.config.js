import typescript from 'rollup-plugin-typescript2';
import fs from 'fs';
let pkg = JSON.parse(fs.readFileSync('./package.json'));
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import resolve from 'rollup-plugin-node-resolve';
import commonJS from 'rollup-plugin-commonjs'

export default {
  input: `./out-tsc/index.js`,
  external: ['react', 'olik'],
  output: [
    {
      file: pkg.main,
      format: 'cjs',
    },
    {
      file: pkg.module,
      format: 'es', // the preferred format
    },
  ].map(e => ({
    ...e, sourcemap: true, globals: {
      'react': 'React'
    }
  })),
  plugins: [
    resolve({
      mainFields: ["main", "module", "browser"]
    }),
    peerDepsExternal(),
    commonJS({
      include: 'node_modules/**'
    }),
    typescript({
      typescript: require('typescript')
    }),
  ],
  onwarn: function(warning) {
    if ( warning.code === 'THIS_IS_UNDEFINED' ) { /* skip this benign warning */ return; }
    console.warn( warning.message );
  }
};
