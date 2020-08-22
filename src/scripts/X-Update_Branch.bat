BRANCH=UltraKevs_Bundle_of_Sticks2
echo "This creates a new branch, check to make sure that $BRANCH is the right name, and that it matches the one in X-New_Branch.bat"
pause
D:
cd twodsix-foundryvtt
git status
echo "If git status is not empty, stop and fix"
pause
git fetch
git checkout master
git rebase upstream/master
git push --force
git checkout $BRANCH
git rebase upstream/master
pause
