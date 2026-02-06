const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { setupTypewizEndpoints } = require('../../index');

module.exports = {
  mode: 'development',
  entry: './index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.js$/,
        include: path.resolve(__dirname),
        exclude: /node_modules/,
        use: {
          loader: require.resolve('../../lib/webpack-loader.js'),
          options: {
            // TypeWiz Enhanced automatically instruments all functions - no configuration needed!
          }
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html'
    })
  ],
  devServer: {
    static: './dist',
    port: 8080,
    hot: true,
    setupMiddlewares: (middlewares, devServer) => {
      console.log('🔧 [TypeWiz] Setting up enhanced endpoints...');
      setupTypewizEndpoints(devServer.app, './typewiz-collection.db');
      return middlewares;
    }
  }
};
