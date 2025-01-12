const ical = require('node-ical');
const fs = require('fs');
const YAML = require('yaml');

const emojiRegex = /([\u0300-\uFFFF ]+)$/;
const yamlStr = fs.readFileSync('../data/pastafarian.yaml', 'utf8');
const pastafarian = YAML.parse(yamlStr);

const emojiMap = new Map();
for (const [date, rawSubject] of Object.entries(pastafarian)) {
  if (date.startsWith('2016-')) {
    const [subject, emoji] = cleanStr(rawSubject);
    if (emoji) {
      emojiMap.set(subject.toLowerCase(), emoji);
    }
  }
}

const events = ical.sync.parseFile('basic.ics');
for (const event of Object.values(events)) {
  if (event.type !== 'VEVENT') {
    continue;
  }
  const dt = event.start.toISOString().substring(0, 10);
  let summary = event.summary.trim();
  const subjLc = summary.toLowerCase();
  const emoji = emojiMap.get(subjLc);
  if (emoji) {
    summary += ' ' + emoji;
  }
  console.log(`${dt}: ${summary}`);
};

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
