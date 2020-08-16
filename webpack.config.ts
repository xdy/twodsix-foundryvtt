import path from "path";
import fs from "fs-extra";
import CopyWebpackPlugin from "copy-webpack-plugin";
import WriteFilePlugin from "write-file-webpack-plugin";
import {Configuration} from "webpack";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import glob from "glob";

//Only a partial type, not sure what else can be in this, and haven't looked into it.
type FoundryConfig = { dataPath:string, systemName:string };

function getFoundryConfig():FoundryConfig {
  const configPath = path.resolve(process.cwd(), 'foundryconfig.json');

  if (fs.existsSync(configPath)) {
    return fs.readJSONSync(configPath);
  }
}


module.exports = (env, argv) => {
  const config:Configuration = {
    context: __dirname,
    entry: glob.sync('./src/*.ts', './src/**/*.ts').reduce((acc, file) => {
      acc[file.replace(/^\.\/src\/(.*?)\.js$/, (_, filename) => filename)] = file
      return acc
    }, {}),
    mode: "development",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.(sa|sc|c)ss$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader?url=false'
            }
          ]

        },
        {test: /\.(png|svg|jpg|gif|woff|woff2|eot|ttf|otf)$/, use: ['url-loader?limit=100000']}
      ],
    },
    plugins: [
      new CopyWebpackPlugin({
          patterns: [
            {from: 'static'}
          ],
        }, {
          writeToDisk: true
        }
      ),
      new WriteFilePlugin(),
      new MiniCssExtractPlugin({
        filename: 'styles/twodsix.css'
      })
    ],
    resolve: {
      extensions: ['.tsx', '.ts', '.js']
    },
    output: {
      path: path.join(__dirname, 'dist'),
      filename: '[name].js'
    },
  };


  if (argv.mode !== 'production') {
    const foundryConfig:FoundryConfig = getFoundryConfig();
    if (foundryConfig !== undefined) {
      config.output.path = path.join(foundryConfig.dataPath, 'Data', 'systems', foundryConfig.systemName);
    }

    config.devtool = 'inline-source-map';
    config.watch = true;
  }

  return config;
};
