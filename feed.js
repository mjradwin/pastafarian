'use strict';
/* eslint-disable require-jsdoc */

Object.defineProperty(exports, '__esModule', {value: true});

const dayjs = require('dayjs');
const {Event, flags, HDate} = require('@hebcal/core');
const {IcalEvent, icalEventsToString} = require('@hebcal/icalendar');
const {makeEvent} = require('./events');

async function icalFeed(ctx) {
  const now = new Date();
  const dtstamp = IcalEvent.makeDtstamp(now);
  const options = {dtstamp};
  const startDt = dayjs('2016-01-01');
  const endDt = dayjs('2017-01-01');
  const icals = [];
  for (let d = startDt; d.isBefore(endDt); d = d.add(1, 'day')) {
    const event = makeEvent(d);
    const title = event.emoji ?
      `${event.emoji} ${event.subject} ${event.emoji}` :
      event.subject;
    const ev = new PastaEvent(d, title, event);
    const ical = new IcalEvent(ev, options);
    const lines = ical.getLongLines();
    const alarmIdx = lines.findIndex((line) => line.startsWith('BEGIN:VALARM'));
    const month = d.month() + 1;
    lines.splice(alarmIdx, 0,
        'CLASS:PUBLIC',
        `RRULE:FREQ=YEARLY;INTERVAL=1;BYMONTH=${month}`,
    );
    icals.push(ical);
  }
  ctx.lastModified = now;
  ctx.set('Cache-Control', 'max-age=604800'); // 7 days
  ctx.type = 'text/calendar; charset=utf-8';
  ctx.body = await icalEventsToString(icals, {
    title: 'Pastafarian Holy Days',
    caldesc: 'Pastafarian Calendar of Special Days from pastafarians.org.au',
    prodid: '-//pastafariancalendar.com/NONSGML Pastafarian Calendar v1.3//EN',
    publishedTTL: 'PT14D',
    dtstamp,
  });
}

class PastaEvent extends Event {
  constructor(d, desc, pastaEvent) {
    super(new HDate(d.toDate()), desc, flags.USER_EVENT);
    this.uid = 'pastafarian-' + d.format('MM-DD');
    this.locationName = 'Pastafarian Holy Day';
    this.alarm = 'P0DT9H0M0S';
    this.category = 'Holiday';
    this.pastaEvent = pastaEvent;
    // this.memo = 'https://www.pastafariancalendar.com' + this.pastaEvent.url;
  }
}

exports.icalFeed = icalFeed;
