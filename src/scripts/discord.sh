# Inspired by https://github.com/DiscordHooks/github-actions-discord-webhook

COMMIT_MESSAGE="$(git log -1 "$GITHUB_SHA" --pretty="%B" | sed 's/\r$//')" 
VERSION="$(git describe --tags --abbrev=0)"

# local debug
# COMMIT_MESSAGE="$(git log -1 --skip 1 --pretty="%B" | sed 's/\r$//')" 
# VERSION="$(git describe --tags --abbrev=0)"

MESSAGE='@everyone Update '$VERSION'\n\n'$COMMIT_MESSAGE'\n\n'

# AVATAR="https://github.com/xdy/twodsix-foundryvtt/blob/master/static/assets/twodsix_icon.webp"
# \"avatar_url\": \"$AVATAR\",
WEBHOOK_DATA="{
  \"username\": \"Twodsix\",
  \"content\": \"${MESSAGE//$'\n'/\\n}\"
}"

REGEX="^(feat|fix):|BREAKING CHANGE"
if [[ $COMMIT_MESSAGE =~ $REGEX ]];
then
    echo -e "[Webhook]: Sending webhook to Discord...\\n";
    (curl --fail --progress-bar -A "GitHub-Actions-Webhook" -H Content-Type:application/json -H X-Author:k3rn31p4nic#8383 -d "${WEBHOOK_DATA}" "$1" && echo -e "\\n[Webhook]: Successfully sent the webhook.") || echo -e "\\n[Webhook]: Unable to send webhook." 
fi

