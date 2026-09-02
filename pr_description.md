Title: 🧪 Test missing branch in compareGamesByTime

Description:

🎯 **What:**
Added an explicit test case to handle the edge case where both objects provided to `compareGamesByTime` contain `NaN` for `timeNum`, which correctly evaluates the branch returning `0`.

📊 **Coverage:**
The branch evaluating `!isNumA && !isNumB` in `compareGamesByTime` logic was not explicitly hit during tests in a way that guaranteed branch coverage for `return 0`. By explicitly passing two elements with a `NaN` `timeNum`, we ensure coverage hits the default `else` condition.

✨ **Result:**
Overall coverage in `index.js` increases. The branch conditions for `compareGamesByTime` inside `index.js` are now properly covered and verified.
