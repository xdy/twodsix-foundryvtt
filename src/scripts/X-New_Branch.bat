BRANCH=UltraKevs_Bundle_of_Sticks2
echo "This creates a new branch, check to make sure that $BRANCH is the right name, and that it matches the one in X-Update_Branch.bat"
pause
d:
cd \GitHub\twodsix-foundryvtt
git checkout -b $BRANCH
git push --set-upstream origin $BRANCH
pause
