module.exports = {
    "plugins": [
        "@semantic-release/commit-analyzer",
        "@semantic-release/release-notes-generator",
        "@semantic-release/changelog",
        ["@semantic-release/exec", {
            "prepareCmd": 'sed -ie \'s|\\(.*"version"\\): "\\(.*\\)",.*|\\1: \'"\\"${nextRelease.version}\\",|" src/system.json && cp src/system.json dist',
        }],
        ["@semantic-release/git", {
            "assets": ["CHANGELOG.md", "package.json", "src/system.json", "dist/system.json", "dist/twodsix.bundle.js.zip"],
            "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
        }],
        ["@semantic-release/github", {
            "assets": ["dist/system.json", "dist/twodsix.bundle.js.zip"],
        }]
    ],
    "preset": "angular"
}