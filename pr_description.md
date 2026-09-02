## Title: 🧹 Simplify CSV parsing loop with guard clause

## Description:
🎯 **What:** Replaced the deeply nested `if (gameName !== "" && gameName !== "#N/A") { ... }` block with an early `if (!gameName || gameName === "#N/A") continue;` guard clause in the CSV parsing loop within `index.js`.

💡 **Why:** By employing a guard clause at the start of the loop iteration, we successfully un-nest the core data transformation logic. This prevents unnecessary conditional checks and variable assignments further down the block, noticeably improving readability and codebase health without altering existing functionality.

✅ **Verification:** Verified by running the comprehensive unit test suite (`npm run test`), ensuring all data mapping and handling logic remains perfectly intact after the refactoring.

✨ **Result:** A cleaner, flatter loop structure that is easier to maintain and comprehend.
