const path = require("path");
const fs = require('fs-extra');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WriteFilePlugin = require('write-file-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

function getFoundryConfig() {
    const configPath = path.resolve(process.cwd(), 'foundryconfig.json');
    let config;

    if (fs.existsSync(configPath)) {
        config = fs.readJSONSync(configPath);
        return config;
    }
}


module.exports = (env, argv) => {
    let config = {
        context: __dirname,
        entry: {
            main: "./src/twodsix.ts",
        },
        mode: "none",
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.scss$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: 'css-loader?url=false'
                        },
                        {
                            loader: 'sass-loader',
                            options: {
                                sourceMap: true,
                            }
                        }
                    ]
                }
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
            filename: "twodsix.bundle.js",
        },
    };


    if (argv.mode === 'production') {
    } else {
        const foundryConfig = getFoundryConfig();
        if (foundryConfig !== undefined)
            config.output.path = path.join(foundryConfig.dataPath, 'Data', 'systems', foundryConfig.systemName);

        config.devtool = 'inline-source-map';
        config.watch = true;
    }

    return config;
};
