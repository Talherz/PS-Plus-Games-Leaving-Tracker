const { performance } = require('perf_hooks');

// Generate mock data
const numItems = 100000;
const leavingGamesData = [];
for (let i = 0; i < numItems; i++) {
  leavingGamesData.push({
    timeRaw: i % 10 === 0 ? "N/A" : (Math.random() * 100).toFixed(2).toString()
  });
}

const originalData = [...leavingGamesData];
const optimizedData = leavingGamesData.map(item => ({
  timeRaw: item.timeRaw,
  parsedTime: parseFloat(item.timeRaw)
}));

// Baseline
const startBaseline = performance.now();
originalData.sort((a, b) => {
  const timeA = parseFloat(a.timeRaw);
  const timeB = parseFloat(b.timeRaw);

  const isNumA = !isNaN(timeA);
  const isNumB = !isNaN(timeB);

  if (isNumA && isNumB) {
    return timeA - timeB;
  } else if (isNumA && !isNumB) {
    return -1;
  } else if (!isNumA && isNumB) {
    return 1;
  } else {
    return 0;
  }
});
const endBaseline = performance.now();

// Optimized
const startOptimized = performance.now();
optimizedData.sort((a, b) => {
  const timeA = a.parsedTime;
  const timeB = b.parsedTime;

  const isNumA = !isNaN(timeA);
  const isNumB = !isNaN(timeB);

  if (isNumA && isNumB) {
    return timeA - timeB;
  } else if (isNumA && !isNumB) {
    return -1;
  } else if (!isNumA && isNumB) {
    return 1;
  } else {
    return 0;
  }
});
const endOptimized = performance.now();

console.log(`Baseline sorting ${numItems} items: ${endBaseline - startBaseline} ms`);
console.log(`Optimized sorting ${numItems} items: ${endOptimized - startOptimized} ms`);
