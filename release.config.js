module.exports = {
    "plugins": [
        "@semantic-release/commit-analyzer",
        "@semantic-release/release-notes-generator",
        "@semantic-release/changelog",
        ["@semantic-release/exec", {
            "prepareCmd": '' +
                'sed -ie \'s|\\(.*"version"\\): "\\(.*\\)",.*|\\1: \'"\\"${nextRelease.version}\\",|" static/system.json ' +
                '&& cp static/system.json dist ' +
                '&& sed -ie \'s|\\(.*"version"\\): "\\(.*\\)",.*|\\1: \'"\\"${nextRelease.version}\\",|" package.json ' +
                '&& npm install ' +
                '&& zip -ur dist/twodsix.zip ' +
                '',
        }],
        ["@semantic-release/git", {
            "assets": ["CHANGELOG.md", "package.json", "package-lock.json", "static/system.json"],
            "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
        }],
        ["@semantic-release/github", {
            "assets": ["dist/system.json", "dist/twodsix.zip"],
        }]
    ],
    "preset": "angular"
}