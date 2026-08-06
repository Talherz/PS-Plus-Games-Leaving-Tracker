const { performance } = require('perf_hooks');

function escapeMarkdownOriginal(text) {
  if (!text) return text;
  return String(text).replace(/([\\*_~`|<>[\]])/g, '\\$1');
}

const ESCAPE_REGEX = /([\\*_~`|<>[\]])/g;
function escapeMarkdownOptimized(text) {
  if (!text) return text;
  return String(text).replace(ESCAPE_REGEX, '\\$1');
}

const text = "Some text with **markdown** and *italics* and ~strikethrough~ [link](http://example.com) <test>";

const iterations = 5000000;

const startOriginal = performance.now();
for (let i = 0; i < iterations; i++) {
  escapeMarkdownOriginal(text);
}
const endOriginal = performance.now();
console.log("Baseline benchmark time:", (endOriginal - startOriginal).toFixed(2), "ms");

const startOptimized = performance.now();
for (let i = 0; i < iterations; i++) {
  escapeMarkdownOptimized(text);
}
const endOptimized = performance.now();
console.log("Optimized benchmark time:", (endOptimized - startOptimized).toFixed(2), "ms");
