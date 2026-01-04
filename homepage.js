import dayjs from 'dayjs';
import { matomoTrack } from './analytics.js';
import { makeEvents, eventJsonLD, holidayHash } from './events.js';
import { makeETag } from './etag.js';

export async function homepage(ctx) {
  const today = dayjs();
  ctx.response.etag = makeETag(ctx, {
    today: today.format('YYYYMMDD'),
    holidayHash,
  });
  ctx.status = 200;
  if (ctx.fresh) {
    ctx.status = 304;
    return;
  }
  const upcoming = makeEvents(today, today.add(7, 'd'));
  for (const ev of upcoming) {
    ev.jsonLD = eventJsonLD(ev);
  }
  const ev = upcoming.shift();
  const y1 = upcoming[0].d.year();
  const y2 = upcoming.at(-1).d.year();
  const yearStr = y1 === y2 ? y1 : `${y1}-${y2}`;
  matomoTrack(ctx, 'Pastafarian Holiday Calendar');
  return ctx.render('homepage', {
    today,
    ev,
    yearStr,
    upcoming,
  });
}
