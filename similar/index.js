import {distance, closest} from 'fastest-levenshtein';
import {rawEvents, cleanStr} from '../events.js';

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

const updated = Object.assign({}, rawEvents);
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
    const emoji2 = emojiMap.get(candidate);
    updated[date] = `${subject} ${emoji2}`;
  }
}

for (const [date, rawSubject] of Object.entries(updated)) {
  console.log(`${date}: ${rawSubject}`);
}
