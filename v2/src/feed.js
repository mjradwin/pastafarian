import {Event, flags, HDate} from '@hebcal/core';
import {IcalEvent} from '@hebcal/icalendar';
import {pastafarian} from './events';

const memo = 'Pastafarian Holy Day';

const title = 'Pastafarian Holy Days';
const caldesc = 'Pastafarian Calendar of Special Days from pastafarians.org.au';
const preamble = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  `PRODID:-//pastafariancalendar.com/NONSGML Pastafarian Calendar v1.2//EN`,
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'X-PUBLISHED-TTL:PT14D',
  `X-WR-CALNAME:${title}`,
  `X-WR-CALDESC:${caldesc}`,
].map(IcalEvent.fold).join('\r\n');
icalStream.write(preamble);
icalStream.write('\r\n');

const options = {
  dtstamp: IcalEvent.makeDtstamp(new Date()),
};

for (const [monthDay, subj] of Object.entries(pastafarian)) {
  const {ev, month} = makeEvent(2016, monthDay, subj);
  ev.uid = `pastafarian-${monthDay}`;
  const ical = new IcalEvent(ev, options);
  ical.locationName = memo;
  const lines = ical.getLongLines();
  const triggerIdx = lines.findIndex((line) => line.startsWith('TRIGGER'));
  lines[triggerIdx] = 'TRIGGER:P0DT9H0M0S';
  const catIdx = lines.findIndex((line) => line.startsWith('CATEGORIES'));
  lines[catIdx] = `CATEGORIES:Holiday`;

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
  const ev = new Event(new HDate(dt), summary, flags.USER_EVENT);
  return {ev, month};
}
