import compress from 'koa-compress';
import dayjs from 'dayjs';
import error from 'koa-error';
import xResponseTime from 'koa-better-response-time';
import conditional from 'koa-conditional-get';
import etag from '@koa/etag';
import Koa from 'koa';
import koaLogger from 'koa-pino-logger';
import path from 'path';
import {fileURLToPath} from 'url';
import render from '@koa/ejs';
import serve from 'koa-static';
import zlib from 'zlib';
import {basename} from 'path';
import {makeEvent, makeEvents, isoDateStringToDate,
  makeEventsFullCalendar, eventDetail, eventJsonLD} from './events.js';
import {makeHolidays} from './holidays.js';
import {icalFeed} from './feed.js';
import {sitemap} from './sitemap.js';
import {matomoTrack} from './analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new Koa();
app.context.launchDate = new Date();

/*
const transport = pino.transport({
  target: 'pino/file',
  level: isProduction ? 'info' : 'debug',
  options: {destination: logDir + '/access.log'},
});
*/

app.use(xResponseTime());
app.use(async function myResponseTime(ctx, next) {
  ctx.state.startTime = Date.now();
  await next();
});
app.use(koaLogger());

app.use(compress({
  gzip: true,
  deflate: false,
  br: {
    params: {
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      [zlib.constants.BROTLI_PARAM_QUALITY]: 6,
    },
  },
}));

app.use(conditional());
app.use(etag());

render(app, {
  root: path.join(__dirname, 'views'),
  layout: false,
  viewExt: 'ejs',
  debug: false,
  async: true,
});

app.use(error({
  engine: 'ejs',
  template: path.join(__dirname, 'views', 'error.ejs'),
}));

const CACHE_CONTROL_IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000';

// favicon-like files in the directory root that should be cached for 365 days
const rootDirStatic = new Set(`favicon.ico
android-chrome-192x192.png
android-chrome-512x512.png
apple-touch-icon.png
browserconfig.xml
favicon-16x16.png
favicon-32x32.png
mstile-150x150.png
safari-pinned-tab.svg
site.webmanifest`.split('\n').map((s) => '/' + s));

const reIsoDate = /^\d\d\d\d-\d\d-\d\d$/;

app.use(async function router(ctx, next) {
  const rpath = ctx.request.path;
  if (rpath === '/robots.txt') {
    ctx.set('Cache-Control', 'public');
    ctx.lastModified = ctx.launchDate;
    ctx.body = 'User-agent: *\nAllow: /\n';
    return;
  } else if (rpath === '/i' || rpath === '/i/') {
    ctx.lastModified = ctx.launchDate;
    return ctx.render('dir-hidden');
  } else if (rootDirStatic.has(rpath) || rpath.startsWith('/i/') || rpath.endsWith('.png')) {
    ctx.set('Cache-Control', CACHE_CONTROL_IMMUTABLE);
    // let serve() handle this file
  } else if (rpath === '/') {
    const today = dayjs();
    const upcoming = makeEvents(today, today.add(7, 'd'));
    for (const ev of upcoming) {
      ev.jsonLD = eventJsonLD(ev);
    }
    const ev = upcoming.shift();
    const y1 = upcoming[0].d.year();
    const y2 = upcoming[upcoming.length - 1].d.year();
    const yearStr = y1 === y2 ? y1 : `${y1}-${y2}`;
    await matomoTrack(ctx, 'Pastafarian Holiday Calendar');
    ctx.set('Cache-Control', 'private');
    return ctx.render('homepage', {
      today,
      ev,
      yearStr,
      upcoming,
    });
  } else if (rpath.startsWith('/holidays') && rpath.endsWith('.json')) {
    const holidays = makeHolidays();
    ctx.lastModified = new Date();
    ctx.set('Cache-Control', 'public, max-age=604800'); // 7 days
    ctx.body = holidays;
    return;
  } else if (rpath === '/privacy' || rpath === '/about' || rpath === '/holidays') {
    const page = basename(rpath);
    ctx.set('Cache-Control', 'public');
    await matomoTrack(ctx, rpath.substring(1));
    return ctx.render(page);
  } else if (rpath.startsWith('/events.json')) {
    ctx.lastModified = new Date();
    const q = ctx.request.query;
    const events = makeEventsFullCalendar(q.start, q.end);
    // 7 days if found, one hour if empty
    const maxAge = events.length > 0 ? 604800 : 3600;
    ctx.set('Cache-Control', `public, max-age=${maxAge}`);
    ctx.body = events;
    return;
  } else if (rpath.startsWith('/sitemap')) {
    return sitemap(ctx);
  } else if (rpath.startsWith('/feed.ics')) {
    return icalFeed(ctx);
  } else if (rpath.length > 10) {
    const tail = rpath.substring(rpath.length - 10);
    if (reIsoDate.test(tail)) {
      const d = isoDateStringToDate(tail);
      const ev = makeEvent(d);
      const pageTitle = ev ? `${ev.subject} ${d.format('YYYY')}` : 'Unknown';
      await eventDetail(ctx, ev, d);
      await matomoTrack(ctx, pageTitle);
      return;
    }
  }
  await next();
});

const DOCUMENT_ROOT = path.join(__dirname, 'static');
app.use(serve(DOCUMENT_ROOT, {defer: false}));

const port = process.env.NODE_PORT || 8080;
app.listen(port, () => {
  const msg = 'Koa server listening on port ' + port;
  console.log(msg);
});
