import dayjs from 'dayjs';
import { makeETag } from './etag.js';
import { isoDateStringToDate, makeEvent, eventJsonLD } from './events.js';
import { matomoTrack } from './analytics.js';

export async function eventDetailApp(ctx) {
  const rpath = ctx.request.path;
  const tail = rpath.substring(rpath.length - 10);
  const d = isoDateStringToDate(tail);
  const ev = makeEvent(d);
  if (ev) {
    const pageTitle = ev ? `${ev.subject} ${d.format('YYYY')}` : 'Unknown';
    matomoTrack(ctx, pageTitle);
  }
  ctx.type = 'html';
  const today = dayjs();
  if (!ev) {
    ctx.status = 404;
    ctx.set('Cache-Control', 'private');
    return ctx.render('tbd', {
      title: `Unknown Pastafarian Holy Day on ${d.format('MMMM D, YYYY')}`,
      d,
      today,
    });
  }
  ctx.response.etag = makeETag(ctx, {});
  ctx.status = 200;
  if (ctx.fresh) {
    ctx.status = 304;
    return;
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
