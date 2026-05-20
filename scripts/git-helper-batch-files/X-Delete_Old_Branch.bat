BRANCH=UltraKevs_Bundle_of_Sticks2
echo "This DELETES a branch, check to make sure that $BRANCH is the right name, and that you *really* want to delete it."
pause
D:
cd \GitHub\twodsix-foundryvtt
git status
echo "If git status is not empty, stop and fix"
pause
git checkout master
git branch -D $BRANCH
pause
