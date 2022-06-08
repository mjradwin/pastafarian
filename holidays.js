const {rawEvents, cleanStr, makeAnchor} = require('./events');
const dayjs = require('dayjs');

const months = ['',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const dates = Object.keys(rawEvents).reverse();

// eslint-disable-next-line require-jsdoc
function makeHolidays() {
  const holidays = [];
  const m = new Map();
  const startDate = dayjs().subtract(2, 'year');
  for (const date of dates) {
    const d = dayjs(date);
    if (d.isBefore(startDate)) {
      continue;
    }
    const rawSubject = rawEvents[date];
    const [subject, emoji] = cleanStr(rawSubject);
    const subjLc0 = subject.toLowerCase();
    const subjLc = subjLc0.replace(' day', '');
    if (m.has(subjLc)) {
      continue;
    }
    const monthDay = date.substring(5);
    const year = date.substring(0, 4);
    const [month, day] = monthDay.split('-');
    const monthStr = months[parseInt(month, 10)];
    const dayNum = parseInt(day, 10);
    const value = `${monthStr} ${dayNum}, ${year} - ${subject}`;
    const holiday = {
      day: date,
      value: emoji ? value + ' ' + emoji : value,
      subject,
      url: '/' + makeAnchor(subject) + '-' + date,
    };
    if (emoji.length) {
      holiday.emoji = emoji;
    }
    m.set(subjLc, holiday);
    holidays.push(holiday);
  }
  return holidays.reverse();
}

exports.makeHolidays = makeHolidays;
