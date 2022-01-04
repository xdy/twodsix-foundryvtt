SEARCH_PATTERN='(\s\"(manifest|download)\"\: \"https:\/\/github.com\/xdy\/twodsix-foundryvtt\/releases\/).*(\/(system.json|twodsix.zip)\",)'
DEVELOPMENT_REPLACE="\1download/v$1\3"

  sed -i -r  s"~$SEARCH_PATTERN~$DEVELOPMENT_REPLACE~" static/system.json &&
  cp static/system.json dist &&
  sed -i -e 's|\(.*"version"\): "\(.*\)",.*|\1: '"\"$1\",|" package.json &&
  npm install &&
  cd dist || exit &&
  zip -r twodsix.zip ./* &&
  cd ..
