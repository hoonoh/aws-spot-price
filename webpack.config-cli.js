const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    cli: path.resolve(__dirname, 'src/cli.ts'),
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
        test: /\.ts$/,
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
  externalsPresets: {
    node: true,
  },
  externals: [
    {
      './module': 'commonjs ./module',
      'aws-sdk': 'commonjs ./module.vendor',
      'aws-sdk/clients/ec2': 'commonjs ./module.vendor',
      'aws-sdk/lib/error': 'commonjs ./module.vendor',
      'aws-sdk/lib/request': 'commonjs ./module.vendor',
    },
  ],
};
