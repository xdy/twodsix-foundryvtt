module.exports = {
    "plugins": [
        "@semantic-release/commit-analyzer",
        "@semantic-release/release-notes-generator",
        "@semantic-release/changelog",
        ["@semantic-release/exec", {
            "prepareCmd": "./release.sh ${nextRelease.version}",
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