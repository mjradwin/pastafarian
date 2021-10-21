import createError from 'http-errors';
import fs from 'fs';
import YAML from 'yaml';

const yamlStr = fs.readFileSync('../data/pastafarian.yaml', 'utf8');
const pastafarian = YAML.parse(yamlStr);

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
  const startDt = isoDateStringToDate(start);
  const endDt = isoDateStringToDate(end);
  const year = startDt.getFullYear();
  const events = [];
  for (const [monthDay, subj] of Object.entries(pastafarian)) {
    const [monthStr, mday] = monthDay.split('-');
    const month = parseInt(monthStr, 10);
    const dt = new Date(year, month - 1, +mday);
    if (dt >= startDt && dt <= endDt) {
      const event = {
        start: `${year}-${monthDay}`,
        title: cleanStr(subj),
      };
      events.push(event);
    }
  }
  return events;
}

const emojiRegex = /([\u0300-\uFFFF ]+)$/;

/**
 * @return {string}
 * @param {string} s
 */
 function cleanStr(s) {
  const s2 = s.trim().replace(/\.$/, '').replace(/\s+/g, ' ').trim();
  if (s2 === '42 Day 4️⃣2️⃣') {
    return '4️⃣2️⃣ 42 Day 4️⃣2️⃣';
  }
  const matches = emojiRegex.exec(s2);
  if (matches) {
    return matches[1].trim() + ' ' + s2;
  }
  return s2;
}
