MANIFEST_SEARCH_PATTERN='(\s\"(manifest)\"\: \"https:\/\/github.com\/xdy\/twodsix-foundryvtt\/releases\/).*(\/(system.json)\",)'
DOWNLOAD_SEARCH_PATTERN='(\s\"(download)\"\: \"https:\/\/github.com\/xdy\/twodsix-foundryvtt\/releases\/).*(\/(twodsix.zip)\",)'
#For version specific download
VERSION_MAIN_REPLACE="\1download/v$1\3"
#For latest download
LATEST_MAIN_REPLACE="\1latest/download\3"

sed -i -e 's|\(.*"version"\): "\(.*\)",.*|\1: '"\"$1\",|" system.json &&
sed -i -r s"~${MANIFEST_SEARCH_PATTERN}~${LATEST_MAIN_REPLACE}~" system.json &&
sed -i -r s"~${DOWNLOAD_SEARCH_PATTERN}~${VERSION_MAIN_REPLACE}~" system.json &&
cp system.json dist &&
sed -i -e 's|\(.*"version"\): "\(.*\)",.*|\1: '"\"$1\",|" package.json &&
npm install &&
cd dist || exit &&
zip -r twodsix.zip ./* &&
cd ..
