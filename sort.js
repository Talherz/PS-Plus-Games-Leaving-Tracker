function sortByRawHours(a, b) {
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
}

module.exports = { sortByRawHours };
