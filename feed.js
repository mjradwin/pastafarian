/* eslint-disable require-jsdoc */
import dayjs from 'dayjs';
import {Event, flags, HDate} from '@hebcal/core';
import {IcalEvent, icalEventsToString} from '@hebcal/icalendar';
import {makeEvent, rawEvents} from './events.js';

export async function icalFeed(ctx) {
  const now = new Date();
  const dtstamp = IcalEvent.makeDtstamp(now);
  const icals = [];
  const options = {dtstamp};
  const twoYearsAgo = dayjs(now).subtract(2, 'year');
  const dates = Object.keys(rawEvents);
  for (const date of dates) {
    const d = dayjs(date);
    if (d.isBefore(twoYearsAgo)) {
      continue;
    }
    const event = makeEvent(d);
    const title = event.emoji ?
      `${event.emoji} ${event.subject} ${event.emoji}` :
      event.subject;
    const ev = new PastaEvent(d, title, event);
    if (event.desc) {
      ev.memo = event.desc;
      if (event.url2) {
        ev.memo += '\\n\\n' + event.url2;
      }
    }
    const ical = new IcalEvent(ev, options);
    icals.push(ical);
  }
  ctx.lastModified = now;
  ctx.set('Cache-Control', 'public, max-age=604800'); // 7 days
  ctx.type = 'text/calendar; charset=utf-8';
  ctx.body = await icalEventsToString(icals, {
    title: 'Pastafarian Holy Days',
    caldesc: 'The holy days of the year as divined by our Brother in the sauce Ned Bruce Gallagher',
    prodid: '-//pastafariancalendar.com/NONSGML Pastafarian Calendar v2.2//EN',
    publishedTTL: 'PT7D',
    dtstamp,
  });
}

class PastaEvent extends Event {
  constructor(d, desc, pastaEvent) {
    super(new HDate(d.toDate()), desc, flags.USER_EVENT);
    this.uid = 'pastafarian-' + d.format('YYYY-MM-DD');
    this.locationName = 'Pastafarian Holy Day';
    this.alarm = 'P0DT9H0M0S';
    this.category = 'Holiday';
    this.pastaEvent = pastaEvent;
    // this.memo = 'https://www.pastafariancalendar.com' + this.pastaEvent.url;
  }
}
