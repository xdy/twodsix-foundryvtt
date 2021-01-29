sed -i -e 's|\(.*"version"\): "\(.*\)",.*|\1: '"\"$1\",|" static/system.json &&
  if echo "$1" | grep -q "development"; then echo "\"manifest\": \"https://github.com/xdy/twodsix-foundryvtt/releases/download/v$1/download/system.json\"" > static/system.json; else echo "\"manifest\": \"https://github.com/xdy/twodsix-foundryvtt/releases/latest/system.json\"" > static/system.json; fi &&
  cp static/system.json dist &&
  sed -i -e 's|\(.*"version"\): "\(.*\)",.*|\1: '"\"$1\",|" package.json &&
  npm install &&
  npm audit fix &&
  cd dist || exit &&
  zip -r twodsix.zip ./* &&
  cd ..
