const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    cli: path.resolve(__dirname, 'src/cli.ts'),
    module: path.resolve(__dirname, 'src/module.ts'),
  },
  resolve: {
    extensions: ['.js', '.json', '.ts'],
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, 'dist'),
  },
  stats: {
    warningsFilter: [/node_modules\/yargs/],
  },
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
};
