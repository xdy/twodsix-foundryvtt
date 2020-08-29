echo "This builds twodsix from your working folder and keeps updating the installed twodsix system in foundryvtt as you change files. You may need to press f5 in foundryvtt, or even return to setup to see changes."
D:
cd D:\GitHub\twodsix-foundryvtt
call npm install
call npm run build:dev
pause
