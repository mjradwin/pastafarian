import dayjs from 'dayjs';
import {isoDateStringToDate, makeEvents, holidayHash} from './events.js';
import {makeETag} from './etag.js';

/**
 * @param {string} start
 * @param {string} end
 * @return {any[]}
 */
function makeEventsFullCalendar(start, end) {
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

export async function eventsFcJsonApp(ctx) {
  const q = ctx.request.query;
  ctx.type = 'application/json; charset=utf-8';
  ctx.response.etag = makeETag(ctx, { ...q, holidayHash });
  ctx.status = 200;
  if (ctx.fresh) {
    ctx.status = 304;
    return;
  }
  const events = makeEventsFullCalendar(q.start, q.end);
  // 7 days if found, one hour if empty
  const maxAge = events.length > 0 ? 604800 : 3600;
  ctx.set('Cache-Control', `public, max-age=${maxAge}`);
  ctx.body = events;
}
