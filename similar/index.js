const {distance, closest} = require('fastest-levenshtein');
const {rawEvents, cleanStr} = require('../events');

const emojiMap = new Map();

for (const rawSubject of Object.values(rawEvents)) {
  const [subject, emoji] = cleanStr(rawSubject);
  const subjLc0 = subject.toLowerCase();
  const subjLc = subjLc0.replace(' day', '');
  if (emoji && !emojiMap.has(subjLc)) {
    emojiMap.set(subjLc, emoji);
  }
}

const allSubjects = Array.from(emojiMap.keys());

for (const [date, rawSubject] of Object.entries(rawEvents)) {
  const [subject, emoji] = cleanStr(rawSubject);
  if (emoji) {
    continue;
  }
  const subjLc0 = subject.toLowerCase();
  const subjLc = subjLc0.replace(' day', '');
  const candidate = closest(subjLc, allSubjects);
  const editDist = distance(subjLc, candidate);
  if (editDist < 3) {
    console.log(date, rawSubject, candidate, emoji);
  }
}
