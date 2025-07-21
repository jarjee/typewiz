const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { setupTypewizEndpoints } = require('../index');

module.exports = {
  mode: 'development',
  entry: './todo-app/index.js',
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
        include: path.resolve(__dirname, 'todo-app'),
        use: {
          loader: require.resolve('../lib/webpack-loader.js'),
          options: {
            enableProxyDecorators: true
          }
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './todo-app/index.html'
    })
  ],
  devServer: {
    static: './dist',
    port: 8080,
    hot: true,
    onAfterSetupMiddleware: (devServer) => {
      console.log('🔧 [TypeWiz] Setting up enhanced endpoints...');
      setupTypewizEndpoints(devServer.app, './typewiz-collection.db');
    }
  }
};
