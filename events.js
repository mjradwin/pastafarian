'use strict';

Object.defineProperty(exports, '__esModule', {value: true});

const createError = require('http-errors');
const fs = require('fs');
const YAML = require('yaml');
const dayjs = require('dayjs');

const yamlStr = fs.readFileSync('./data/pastafarian.yaml', 'utf8');
const pastafarian = YAML.parse(yamlStr);

const reIsoDate = /^\d\d\d\d-\d\d-\d\d/;

/**
 * Parse a string YYYY-MM-DD and return Date
 * @param {string} str
 * @return {dayjs.Dayjs}
 */
function isoDateStringToDate(str) {
  if (!reIsoDate.test(str)) {
    throw createError(400, `Date must match format YYYY-MM-DD: ${str}`);
  }
  const yy = parseInt(str, 10);
  const mm = parseInt(str.substring(5, 7), 10);
  const dd = parseInt(str.substring(8, 10), 10);
  const dt = new Date(yy, mm - 1, dd);
  if (yy < 100) {
    dt.setFullYear(yy);
  }
  return dayjs(dt);
}

/**
 * @param {string} start
 * @param {string} end
 * @return {any[]}
 */
function makeEvents(start, end) {
  const startDt = start ? isoDateStringToDate(start) : dayjs();
  const endDt0 = end ? isoDateStringToDate(end) : dayjs();
  const endDt = endDt0.add(1, 'day');
  const events = [];
  for (let d = startDt; d.isBefore(endDt); d = d.add(1, 'day')) {
    const event = makeEvent(d);
    delete event.emoji;
    delete event.subject;
    delete event.d;
    events.push(event);
  }
  return events;
}

const emojiRegex = /([\u0300-\uFFFF ]+)$/;

/**
 * @param {dayjs.Dayjs} d
 * @return {any}
 */
function makeEvent(d) {
  const monthDay = d.format('MM-DD');
  const rawSubject = pastafarian[monthDay];
  const ymd = d.format('YYYY-MM-DD');
  const [subject, emoji] = cleanStr(rawSubject);
  const event = {
    start: ymd,
    title: emoji ? `${emoji} ${subject}` : subject,
    url: '/' + makeAnchor(subject) + '-' + ymd,
    subject,
    emoji,
    d,
  };
  return event;
}

/**
 * @return {string[]}
 * @param {string} s
 */
function cleanStr(s) {
  const s2 = s.trim().replace(/\.$/, '').replace(/\s+/g, ' ').trim();
  if (s2 === '42 Day 4️⃣2️⃣') {
    return ['42 Day', '4️⃣2️⃣'];
  }
  const matches = emojiRegex.exec(s2);
  if (matches) {
    const s3 = s2.replace(emojiRegex, '');
    return [s3, matches[1].trim()];
  }
  return [s2, ''];
}

/**
 * Helper function to transform a string to make it more usable in a URL or filename.
 * Converts to lowercase and replaces non-word characters with hyphen ('-').
 * @example
 * makeAnchor('Rosh Chodesh Adar II') // 'rosh-chodesh-adar-ii'
 * @param {string} s
 * @return {string}
 */
function makeAnchor(s) {
  return s.toLowerCase()
      .replace(/'/g, '')
      .replace(/[^\w]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-/g, '')
      .replace(/-$/g, '');
}

/**
 * @param {any} ctx
 * @param {string} isoDateStr
 * @return {any}
 */
async function eventDetail(ctx, isoDateStr) {
  const d = isoDateStringToDate(isoDateStr);
  const ev = makeEvent(d);
  ctx.set('Cache-Control', 'public');
  return ctx.render('event', {
    title: `${ev.title} | Pastafarian Calendar`,
    d,
    ev,
    prev: makeEvent(d.add(-1, 'day')),
    next: makeEvent(d.add(1, 'day')),
    jsonLD: eventJsonLD(ev),
  });
}

/**
 * @param {any} ev
 * @return {any}
 */
function eventJsonLD(ev) {
  const d = ev.d;
  const url = 'https://www.pastafariancalendar.com' + ev.url;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    'name': ev.title + ' ' + d.format('YYYY'),
    'startDate': d.format('YYYY-MM-DD'),
    'endDate': d.format('YYYY-MM-DD'),
    'description': `Pastafarian Holy Day of ${ev.subject} observed by the Church of the Flying Spaghetti Monster`,
    'url': url,
    'location': {
      '@type': 'VirtualLocation',
      'url': url,
    },
  };
}

exports.isoDateStringToDate = isoDateStringToDate;
exports.makeEvents = makeEvents;
exports.makeEvent = makeEvent;
exports.eventDetail = eventDetail;
exports.eventJsonLD = eventJsonLD;
