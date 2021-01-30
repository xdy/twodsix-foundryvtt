SEARCH_PATTERN='(\s\"(manifest|download)\"\: \"https:\/\/github.com\/xdy\/twodsix-foundryvtt\/releases\/).*(\/(system.json|twodsix.zip)\",)'
DEVELOPMENT_REPLACE="\1download/v$1\3"
MASTER_REPLACE="\1latest\3"

sed -i -e 's|\(.*"version"\): "\(.*\)",.*|\1: '"\"$1\",|" static/system.json &&
  if echo "$1" | grep -q "development"; then sed -i -r  s"~$SEARCH_PATTERN~$DEVELOPMENT_REPLACE~" static/system.json; else sed -i -r s"~$SEARCH_PATTERN~$MASTER_REPLACE~" static/system.json; fi &&
  cp static/system.json dist &&
  sed -i -e 's|\(.*"version"\): "\(.*\)",.*|\1: '"\"$1\",|" package.json &&
  npm install &&
  npm audit fix &&
  cd dist || exit &&
  zip -r twodsix.zip ./* &&
  cd ..
