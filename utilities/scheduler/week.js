function pad(n) {
  if (n < 10) return '0' + n;
  return '' + n;
}

function fmt(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function getWeek() {
  let now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();

  let monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let monthNum = month + 1;
  let weekNum = Math.ceil(day / 7);

  let startDay = ((weekNum - 1) * 7) + 1;
  let lastDay = new Date(year, month + 1, 0).getDate();
  let endDay = weekNum * 7;

  if (endDay > lastDay) endDay = lastDay;

  let start = new Date(year, month, startDay);
  let end = new Date(year, month, endDay);

  let key = year + '-' + pad(monthNum) + '-W' + weekNum;
  let label = monthNames[month] + '-W' + weekNum;

  return {
    key: key,
    label: label,
    year: year,
    month: monthNum,
    week: weekNum,
    start: fmt(start),
    end: fmt(end)
  };
}

module.exports = { getWeek };
