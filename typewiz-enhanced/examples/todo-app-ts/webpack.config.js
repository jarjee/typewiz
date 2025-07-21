const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { setupTypewizEndpoints } = require('../../index');

module.exports = {
  mode: 'development',
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.tsx?$/,
        include: path.resolve(__dirname, 'src'),
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,  // Temporarily disable type checking to test line numbers
              configFile: path.resolve(__dirname, 'tsconfig.json')
            }
          },
          {
            loader: require.resolve('../../lib/webpack-loader.js'),
            options: {
              // TypeWiz Enhanced automatically instruments all functions - no configuration needed!
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html'
    })
  ],
  devServer: {
    static: './dist',
    port: 8081,
    hot: true,
    setupMiddlewares: (middlewares, devServer) => {
      console.log('🔧 [TypeWiz] Setting up enhanced endpoints...');
      setupTypewizEndpoints(devServer.app, './typewiz-collection.db');
      return middlewares;
    }
  }
};
