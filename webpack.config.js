const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    cli: path.resolve(__dirname, 'src/cli.ts'),
    module: path.resolve(__dirname, 'src/module.ts'),
  },
  resolve: {
    extensions: ['.js', '.json', '.ts', '.cjs', '.mjs'],
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, 'dist'),
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
  externals: {
    cliui: 'commonjs2 cliui',
    y18n: 'commonjs2 y18n',
    'yargs-parser': 'commonjs2 yargs-parser',
  },
};
