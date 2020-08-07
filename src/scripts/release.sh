sed -i -e 's|\(.*"version"\): "\(.*\)",.*|\1: '"\"$1\",|" static/system.json &&
  cp static/system.json dist &&
  sed -i -e 's|\(.*"version"\): "\(.*\)",.*|\1: '"\"$1\",|" package.json &&
  npm install &&
  npm audit fix &&
  cd dist || exit &&
  zip -r twodsix.zip ./* &&
  cd ..
