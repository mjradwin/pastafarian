import {rawEvents, makeEvent, makeAnchor} from './events.js';
import dayjs from 'dayjs';

const dates = Object.keys(rawEvents).reverse();

// eslint-disable-next-line require-jsdoc
export function makeHolidays() {
  const holidays = [];
  const m = new Map();
  const startDate = dayjs().subtract(2, 'year');
  for (const date of dates) {
    const d = dayjs(date);
    if (d.isBefore(startDate)) {
      continue;
    }
    const event = makeEvent(d);
    const subject = event.subject;
    const emoji = event.emoji;
    const subjLc0 = subject.toLowerCase();
    const subjLc = subjLc0.replace(' day', '').replace(/\d\d\d\d/, 'YYYY');
    if (m.has(subjLc)) {
      continue;
    }
    const value = d.format('MMMM D, YYYY') + ' - ' + subject;
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
