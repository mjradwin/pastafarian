const {Event, flags, HDate} = require('@hebcal/core');
const {IcalEvent} = require('@hebcal/icalendar');
const YAML = require('yaml');
const fs = require('fs');

const file = fs.readFileSync('../data/pastafarian.yaml', 'utf8');
const pastafarian = YAML.parse(file);

const emojiRegex = /([\u0300-\uFFFF ]+)$/;
const memo = 'Pastafarian Holy Day';
// const location = new Location(0, 0, false, 'UTC', memo);

const icalStream = fs.createWriteStream('pastafarian.ics');

const title = 'Pastafarian Holy Days';
const caldesc = 'Pastafarian Calendar of Special Days from pastafarians.org.au';
const preamble = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  `PRODID:-//pastafariancalendar.com/NONSGML Pastafarian Calendar v1.1//EN`,
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'X-PUBLISHED-TTL:PT14D',
  `X-WR-CALNAME:${title}`,
  `X-WR-CALDESC:${caldesc}`,
].map(IcalEvent.fold).join('\r\n');
icalStream.write(preamble);
icalStream.write('\r\n');

for (const [monthDay, subj] of Object.entries(pastafarian)) {
  const {ev, month} = makeEvent(2016, monthDay, subj);
  const ical = new IcalEvent(ev, {dtstamp: '20210709T233240Z'});
  const lines = ical.getLongLines();
  const triggerIdx = lines.findIndex((line) => line.startsWith('TRIGGER'));
  lines[triggerIdx] = 'TRIGGER:P0DT9H0M0S';
  const catIdx = lines.findIndex((line) => line.startsWith('CATEGORIES'));
  lines[catIdx] = `CATEGORIES:Holiday`;

  const uidIdx = lines.findIndex((line) => line.startsWith('UID'));

  lines[uidIdx] = lines[uidIdx].replace(/hebcal/, 'pastafarian');

  const alarmIdx = lines.findIndex((line) => line.startsWith('BEGIN:VALARM'));
  lines.splice(alarmIdx, 0,
      'CLASS:PUBLIC',
      `RRULE:FREQ=YEARLY;INTERVAL=1;BYMONTH=${month}`,
  );
  icalStream.write(ical.toString());
  icalStream.write('\r\n');
}

icalStream.write('END:VCALENDAR\r\n');
icalStream.close();

function makeEvent(gyear, monthDay, title) {
  const [monthStr, mday] = monthDay.split('-');
  const month = parseInt(monthStr, 10);
  const dt = new Date(gyear, month - 1, +mday);
  const summary = cleanStr(title);
  const ev = new Event(new HDate(dt), summary, flags.USER_EVENT, {memo});
  return {ev, month};
}

/**
 * @return {string}
 * @param {string} s
 */
function cleanStr(s) {
  const s2 = s.trim().replace(/\.$/, '').replace(/\s+/g, ' ').trim();
  const matches = emojiRegex.exec(s2);
  if (matches) {
    return matches[1].trim() + ' ' + s2;
  }
  return s2;
}
