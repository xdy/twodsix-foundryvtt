sed -i -e 's|\(.*"version"\): "\(.*\)",.*|\1: '"\"$1\",|" static/system.json &&
  cp static/system.json dist &&
  sed -i -e 's|\(.*"version"\): "\(.*\)",.*|\1: '"\"$1\",|" package.json &&
  if echo "$1" | grep -q "development"; then sed -i -e "s|(.*)/latest/(.*)|\1/$1/\2|" system.json; fi &&
  npm install &&
  npm audit fix &&
  cd dist || exit &&
  zip -r twodsix.zip ./* &&
  cd ..
