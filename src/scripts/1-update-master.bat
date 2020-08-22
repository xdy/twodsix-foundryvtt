echo "This updates master to the latest version, and assumes you have *no* changes you care about. If this is wrong stop and fix"
pause
D:
cd D:\GitHub\twodsix-foundryvtt
git stash
git checkout master
git pull
git fetch upstream
git rebase upstream/master
git push --force
pause
