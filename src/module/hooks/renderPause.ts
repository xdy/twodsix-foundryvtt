Hooks.on("renderPause", (app, html, options) => {
  if (options.paused) {
    const svgImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' preserveAspectRatio='xMidYMid meet' version='1.0' viewBox='0 0 300 300'%3E%3Cg fill='%2329aaff' stroke='none'%3E%3Cpath d='M1636 2943 c-37 -37 -54 -71 -75 -153 -14 -52 -73 -179 -97 -209 -7 -9 -173 99 -213 139 -100 99 -161 134 -161 93 0 -10 -11 -42 -25 -71 -28 -59 -31 -95 -14 -152 7 -21 9 -54 5 -73 l-7 -35 -50 19 c-99 38 -155 72 -225 139 -69 66 -108 89 -122 75 -16 -15 -4 -161 17 -225 13 -36 28 -91 36 -123 11 -52 11 -57 -4 -53 -9 2 -43 7 -76 10 -33 4 -103 20 -155 37 -80 26 -100 29 -124 20 -25 -10 -28 -15 -22 -42 15 -75 56 -154 97 -189 67 -56 119 -107 119 -116 0 -5 -98 -11 -218 -12 -119 -2 -219 -6 -221 -8 -2 -2 3 -12 12 -22 10 -10 17 -21 17 -25 0 -8 107 -109 167 -156 29 -23 59 -54 68 -71 l15 -29 -39 -21 c-58 -29 -207 -70 -257 -70 -23 0 -46 -5 -49 -11 -21 -33 154 -151 256 -173 15 -3 36 -14 49 -24 l22 -18 -84 -79 c-67 -65 -94 -84 -143 -100 -102 -34 -85 -62 70 -116 129 -45 176 -53 225 -39 19 5 36 8 38 5 2 -2 -6 -24 -18 -49 -22 -46 -111 -136 -135 -136 -6 0 -19 -8 -29 -19 -21 -23 -11 -33 67 -57 54 -17 60 -17 105 -1 44 16 132 23 144 12 21 -21 -58 -235 -107 -292 -19 -23 -35 -48 -35 -57 0 -22 40 -30 116 -23 53 4 79 13 143 50 43 25 94 52 115 61 58 24 58 32 -15 -232 -30 -111 -24 -116 82 -62 108 55 143 82 164 128 21 44 44 72 60 72 20 0 37 -78 46 -205 4 -66 8 -121 8 -122 4 -15 37 7 78 49 35 38 53 67 62 101 14 56 63 113 70 81 5 -26 34 -66 118 -161 40 -45 81 -96 91 -114 25 -46 38 -46 53 -2 7 21 30 74 52 118 25 49 42 97 43 124 6 89 26 94 75 19 29 -45 47 -59 123 -99 49 -26 93 -54 98 -63 13 -24 35 -19 40 9 3 13 3 78 1 142 -6 153 -1 162 76 133 78 -30 122 -55 160 -90 26 -24 36 -28 47 -19 8 6 11 15 9 20 -3 4 -8 80 -11 167 l-6 160 45 -9 c24 -4 66 -23 93 -41 44 -29 57 -33 130 -35 55 -1 87 2 99 11 17 12 12 20 -62 107 -99 116 -133 167 -133 197 0 28 6 30 105 36 44 2 105 12 135 21 30 9 76 22 102 28 l48 12 -54 33 c-30 17 -100 75 -156 129 l-102 97 39 12 c21 6 67 25 103 41 36 16 94 40 130 52 96 32 99 35 70 66 -35 38 -131 84 -198 96 -31 6 -78 20 -104 31 -41 17 -46 23 -38 39 11 20 89 69 109 69 19 0 72 39 161 120 82 74 82 74 54 82 -67 18 -219 20 -284 5 -36 -9 -79 -18 -96 -21 l-31 -5 22 64 c20 56 56 120 76 135 3 3 10 16 14 30 4 13 33 50 63 82 l55 58 -180 0 c-142 0 -183 -3 -199 -15 -22 -17 -48 -20 -39 -5 4 6 9 23 11 38 3 15 25 58 49 95 49 76 78 153 73 191 l-3 25 -88 -29 c-88 -30 -130 -48 -239 -100 -32 -16 -60 -24 -64 -19 -3 5 -5 64 -5 130 1 66 -4 129 -9 140 -25 45 -141 0 -192 -74 -12 -18 -30 -42 -41 -54 l-20 -22 -18 34 c-10 19 -28 69 -40 112 -11 43 -35 122 -53 176 l-33 98 -27 -28z m104 -442 c117 -26 263 -88 352 -151 24 -17 54 -38 68 -47 43 -28 173 -166 215 -228 70 -103 129 -234 151 -333 56 -251 35 -473 -66 -689 -154 -331 -482 -562 -840 -593 -341 -30 -620 66 -851 291 -94 92 -127 137 -198 269 -25 47 -76 184 -89 240 -21 88 -35 230 -28 282 4 29 10 78 13 108 7 73 66 248 111 333 146 271 383 445 717 525 54 13 376 8 445 -7z' transform='translate(0.000000,300.000000) scale(0.100000,-0.100000)'/%3E%3Cpath d='M1339 2416 c-129 -23 -262 -77 -377 -153 -59 -39 -202 -170 -202 -184 0 -6 -9 -20 -21 -32 -55 -59 -139 -246 -165 -372 -18 -84 -20 -266 -5 -352 55 -299 257 -560 536 -689 296 -137 658 -109 932 73 74 49 183 151 230 217 21 28 42 56 48 61 21 19 93 190 116 275 34 124 34 339 0 460 -94 341 -348 592 -690 681 -98 26 -297 33 -402 15z' transform='translate(0.000000,300.000000) scale(0.100000,-0.100000)'/%3E%3C/g%3E%3C/svg%3E";
    html.find("img")[0].src = svgImage.replace('%2329aaff',game.settings.get('twodsix', 'defaultColor').replace('#', '%23'));
  }
});
