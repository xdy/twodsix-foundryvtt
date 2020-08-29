BRANCH=UltraKevs_Bundle_of_Sticks2
echo "This creates a new branch, check to make sure that $BRANCH is the right name, and that it matches the one in X-New_Branch.bat"
pause
D:
cd \GitHub\twodsix-foundryvtt
git status
echo "If git status is not empty, stop and fix"
pause
git checkout $BRANCH
git rebase upstream/master
git push --force
pause
