const { resolve } = require('path');

module.exports = {
  mode: 'production',
  entry: {
    cli: resolve(__dirname, 'src/cli.ts'),
    module: resolve(__dirname, 'src/module.ts'),
  },
  resolve: {
    extensions: ['.js', '.json', '.ts', '.cjs', '.mjs'],
    mainFields: ['main'], // yargs build fix
  },
  output: {
    libraryTarget: 'commonjs',
    path: resolve(__dirname, 'dist'),
  },
  ignoreWarnings: [
    {
      module: /node_modules\/yargs/,
    },
  ],
  target: 'node',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  externals: [/\.\/module$/],
  plugins: [
    {
      apply: compiler => {
        // for node.js versions < 16
        compiler.hooks.emit.tap('NodePrefixedModulesReplacer', compilation => {
          const assets = compilation.getAssets();
          assets.forEach(asset => {
            asset.source._children?.forEach(child => {
              if (child._value.includes('node:')) {
                child._value = child._value.replace(new RegExp('node:', 'g'), '');
              }
            });
          });
        });
      },
    },
  ],
};
