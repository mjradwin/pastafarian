import createError from 'http-errors';
import fs from 'fs';
import YAML from 'yaml';
import dayjs from 'dayjs';
import {transliterate} from 'transliteration';
import {distance, closest} from 'fastest-levenshtein';

const yamlStr = fs.readFileSync('./data/pastafarian.yaml', 'utf8');
const pastafarian = YAML.parse(yamlStr);

const yamlStr2 = fs.readFileSync('./data/more.yaml', 'utf8');
const moreInfo = YAML.parse(yamlStr2);

const reIsoDate = /^\d\d\d\d-\d\d-\d\d/;
const emojiRegex = /([\u0300-\uFFFF ]+)$/;
const emojiMap = new Map();

for (const rawSubject of Object.values(pastafarian)) {
  const [subject, emoji] = cleanStr(rawSubject);
  const subjLc0 = subject.toLowerCase();
  const subjLc = subjLc0.replace(' day', '').replace(/\d\d\d\d/, 'YYYY');
  if (emoji && !emojiMap.has(subjLc)) {
    emojiMap.set(subjLc, emoji);
  }
}

const allSubjects = Array.from(emojiMap.keys());

/**
 * Parse a string YYYY-MM-DD and return Date
 * @param {string} str
 * @return {dayjs.Dayjs}
 */
export function isoDateStringToDate(str) {
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
 * @param {dayjs.Dayjs} startDt
 * @param {dayjs.Dayjs} endDt0
 * @return {any[]}
 */
export function makeEvents(startDt, endDt0) {
  const endDt = endDt0.add(1, 'day');
  const events = [];
  for (let d = startDt; d.isBefore(endDt); d = d.add(1, 'day')) {
    const event = makeEvent(d);
    if (event !== null) {
      events.push(event);
    }
  }
  return events;
}

/**
 * @param {string} start
 * @param {string} end
 * @return {any[]}
 */
export function makeEventsFullCalendar(start, end) {
  const startDt = start ? isoDateStringToDate(start) : dayjs();
  const endDt0 = end ? isoDateStringToDate(end) : dayjs();
  const events = makeEvents(startDt, endDt0);
  for (const event of events) {
    delete event.emoji;
    delete event.subject;
    delete event.d;
  }
  return events;
}

/**
 * @param {dayjs.Dayjs} d
 * @return {any}
 */
export function makeEvent(d) {
  const ymd = d.format('YYYY-MM-DD');
  const rawSubject = pastafarian[ymd];
  if (!rawSubject) {
    return null;
  }
  const [subject, emoji0] = cleanStr(rawSubject);
  let emoji = emoji0;
  if (!emoji0) {
    const subjLc0 = subject.toLowerCase();
    const subjLc = subjLc0.replace(' day', '').replace(/\d\d\d\d/, 'YYYY');
    const candidate = closest(subjLc, allSubjects);
    const editDist = distance(subjLc, candidate);
    if (editDist < 3) {
      emoji = emojiMap.get(candidate);
    }
  }
  const event = {
    start: ymd,
    title: emoji ? `${emoji} ${subject}` : subject,
    url: '/' + makeAnchor(subject) + '-' + ymd,
    subject,
    emoji,
    d,
  };
  const extra0 = moreInfo[subject];
  const extra = typeof extra0 === 'string' ? moreInfo[extra0] : extra0;
  if (Array.isArray(extra)) {
    event.desc = extra[0];
    event.url2 = extra[1];
  }
  return event;
}

/**
 * @return {string[]}
 * @param {string} s
 */
export function cleanStr(s) {
  const s2 = s.trim().replace(/\.$/, '').replace(/\s+/g, ' ').trim();
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
export function makeAnchor(s) {
  return transliterate(s)
      .toLowerCase()
      .replace(/'/g, '')
      .replace(/[^\w]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-/g, '')
      .replace(/-$/g, '');
}

/**
 * @param {any} ctx
 * @param {string} ev
 * @param {dayjs.Dayjs} d
 * @return {any}
 */
export async function eventDetail(ctx, ev, d) {
  const today = dayjs();
  if (!ev) {
    ctx.set('Cache-Control', 'private');
    return ctx.render('tbd', {
      title: `Unknown Pastafarian Holy Day on ${d.format('MMMM D, YYYY')}`,
      d,
      today,
    });
  }
  ctx.set('Cache-Control', 'public');
  return ctx.render('event', {
    title: `${ev.subject} ${d.format('YYYY')} | Pastafarian Holidays`,
    d,
    ev,
    prev: makeEvent(d.add(-1, 'day')),
    next: makeEvent(d.add(1, 'day')),
    jsonLD: eventJsonLD(ev),
    today,
  });
}

/**
 * @param {any} ev
 * @return {any}
 */
export function eventJsonLD(ev) {
  const d = ev.d;
  const url = 'https://www.pastafariancalendar.com' + ev.url;
  const name = ev.subject + ' ' + d.format('YYYY') + ' ' + ev.emoji;
  // eslint-disable-next-line max-len
  const desc = ev.desc || `Pastafarian Holy Day of ${ev.subject} observed by the Church of the Flying Spaghetti Monster`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    'name': name.trim(),
    'startDate': d.format('YYYY-MM-DD'),
    'endDate': d.format('YYYY-MM-DD'),
    'description': desc,
    'url': url,
    'eventAttendanceMode': 'https://schema.org/OnlineEventAttendanceMode',
    'location': {
      '@type': 'VirtualLocation',
      'url': ev.url2 || url,
    },
    'offers': {
      '@type': 'Offer',
      'price': 0,
      'priceCurrency': 'USD',
      'availability': 'https://schema.org/InStock',
      'validFrom': new Date().toISOString().substring(0, 16),
    },
    'organizer': {
      '@type': 'Organization',
      'name': 'Church of the Flying Spaghetti Monster',
      'url': 'https://www.spaghettimonster.org/',
    },

  };
}

export {pastafarian as rawEvents};
