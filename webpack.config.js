const path = require('path');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'src/cli.ts'),
  resolve: {
    extensions: ['.js', '.json', '.ts'],
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, 'dist'),
    filename: 'aws-spot-price.bundle.js',
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
};
