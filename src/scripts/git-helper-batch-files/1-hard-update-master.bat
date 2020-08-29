echo "This forcibly updates your master branch to the latest version, *throwing away all your changes*, and assumes you have *no* local changes you care about. If this is wrong stop and fix."
echo "Note that this or something equivalent *should* be run before making a new branch that you intend to make a Pull Request from."
D:
cd D:\GitHub\twodsix-foundryvtt
git checkout master
git status
pause
git fetch upstream
git reset --hard upstream/master
git push origin master --force
pause
echo "After this you can run X-New_Branch.bat to create a new branch"
