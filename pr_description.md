Title: 🧪 Add error handling tests for readSavedState

Description:

🎯 **What:**
Added a comprehensive test suite for `readSavedState` to address a testing gap where the error handling behavior for different types of errors (ENOENT vs non-ENOENT) was not being properly tested.

📊 **Coverage:**
The new test suite covers:
* Throwing exceptions when `fs.promises.readFile` throws a non-ENOENT error (e.g., EACCES).
* Catching and returning an empty string `""` when an ENOENT error occurs.
* Returning the actual file content on a successful read.

✨ **Result:**
Improved the overall test coverage and reliability of the `index.js` `readSavedState` function by verifying the behavior of edge cases, particularly regarding differing error codes.
