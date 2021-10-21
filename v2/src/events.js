import createError from 'http-errors';
import fs from 'fs';
import YAML from 'yaml';
import dayjs from 'dayjs';

const yamlStr = fs.readFileSync('../data/pastafarian.yaml', 'utf8');
export const pastafarian = YAML.parse(yamlStr);

const reIsoDate = /^\d\d\d\d-\d\d-\d\d/;

/**
 * Parse a string YYYY-MM-DD and return Date
 * @param {string} str
 * @return {Date}
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
  return dt;
}

/**
 * @param {string} start
 * @param {string} end
 * @return {any[]}
 */
export function makeEvents(start, end) {
  const startDt = dayjs(isoDateStringToDate(start));
  const endDt = dayjs(isoDateStringToDate(end)).add(1, 'day');
  const events = [];
  for (let d = startDt; d.isBefore(endDt); d = d.add(1, 'day')) {
    const event = makeEvent(d);
    events.push(event);
  }
  return events;
}

const emojiRegex = /([\u0300-\uFFFF ]+)$/;

/**
 * @param {dayjs.Dayjs} d
 * @return {any}
 */
export function makeEvent(d) {
  const monthDay = d.format('MM-DD');
  const subj = pastafarian[monthDay];
  const ymd = d.format('YYYY-MM-DD');
  const event = {
    start: ymd,
    title: cleanStr(subj),
    url: '/' + makeAnchor(subj) + '-' + ymd,
  };
  return event;
}

/**
 * @return {string}
 * @param {string} s
 */
function cleanStr(s) {
  const s2 = s.trim().replace(/\.$/, '').replace(/\s+/g, ' ').trim();
  if (s2 === '42 Day 4️⃣2️⃣') {
    return '4️⃣2️⃣ 42 Day';
  }
  const matches = emojiRegex.exec(s2);
  if (matches) {
    const s3 = s2.replace(emojiRegex, '');
    return matches[1].trim() + ' ' + s3;
  }
  return s2;
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
