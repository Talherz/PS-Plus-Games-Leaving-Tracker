const fs = require('fs');

// Generate realistic sample data
function generateData(count) {
  const data = [];
  for (let i = 0; i < count; i++) {
    // Some are valid numbers, some are empty or non-numbers
    let rawCompletion;
    const rand = Math.random();
    if (rand < 0.1) {
      rawCompletion = ""; // missing
    } else if (rand < 0.2) {
      rawCompletion = "TBD"; // string
    } else {
      rawCompletion = (Math.random() * 100).toFixed(1); // string number
    }

    const parsedTime = parseFloat(rawCompletion);

    data.push({
      id: i,
      timeRaw: rawCompletion,
      parsedTime: parsedTime,
      isNumTime: !isNaN(parsedTime)
    });
  }
  return data;
}

const dataSize = 10000;
const iterations = 1000;

console.log(`Benchmarking array of size ${dataSize} with ${iterations} iterations...`);

const baseData = generateData(dataSize);

function benchmarkBaseline() {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    // Copy array to sort
    const arr = [...baseData];
    arr.sort((a, b) => {
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
  }
  const end = performance.now();
  return end - start;
}

function benchmarkOptimized() {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    // Copy array to sort
    const arr = [...baseData];
    arr.sort((a, b) => {
      if (a.isNumTime && b.isNumTime) {
        return a.parsedTime - b.parsedTime;
      } else if (a.isNumTime && !b.isNumTime) {
        return -1;
      } else if (!a.isNumTime && b.isNumTime) {
        return 1;
      } else {
        return 0;
      }
    });
  }
  const end = performance.now();
  return end - start;
}

// Warmup
benchmarkBaseline();
benchmarkOptimized();

// Actual benchmark
const baselineTime = benchmarkBaseline();
const optimizedTime = benchmarkOptimized();

console.log(`Baseline Time: ${baselineTime.toFixed(2)} ms`);
console.log(`Optimized Time: ${optimizedTime.toFixed(2)} ms`);
console.log(`Improvement: ${((baselineTime - optimizedTime) / baselineTime * 100).toFixed(2)}% faster`);
