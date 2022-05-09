'use strict';

const compress = require('koa-compress');
const dayjs = require('dayjs');
const error = require('koa-error');
const conditional = require('koa-conditional-get');
const etag = require('koa-etag');
const Koa = require('koa');
const koaLogger = require('koa-pino-logger');
const path = require('path');
const render = require('koa-ejs');
const serve = require('koa-static');
const zlib = require('zlib');
const {basename} = require('path');
const {makeEvents, makeEventsFullCalendar, eventDetail, eventJsonLD} = require('./events');
const {makeHolidays} = require('./holidays');
const {icalFeed} = require('./feed');
const {sitemap} = require('./sitemap');

const app = new Koa();
app.context.launchDate = new Date();

/*
const transport = pino.transport({
  target: 'pino/file',
  level: isProduction ? 'info' : 'debug',
  options: {destination: logDir + '/access.log'},
});
*/

app.use(koaLogger());
app.use(conditional());
app.use(etag());

app.use(googleAnalytics4('G-Y5E7QMMGP4'));

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
    ctx.state.trackPageview = true;
    ctx.set('Cache-Control', 'private');
    return ctx.render('homepage', {
      today,
      ev,
      yearStr,
      upcoming,
    });
  } else if (rpath.startsWith('/holidays2.json')) {
    const holidays = makeHolidays();
    ctx.lastModified = new Date();
    ctx.set('Cache-Control', 'public, max-age=604800'); // 7 days
    ctx.body = holidays;
    return;
  } else if (rpath === '/privacy' || rpath === '/about' || rpath === '/holidays') {
    const page = basename(rpath);
    ctx.set('Cache-Control', 'public');
    ctx.state.trackPageview = true;
    return ctx.render(page);
  } else if (rpath.startsWith('/events.json')) {
    ctx.lastModified = new Date();
    ctx.set('Cache-Control', 'public, max-age=604800'); // 7 days
    const q = ctx.request.query;
    ctx.body = makeEventsFullCalendar(q.start, q.end);
    return;
  } else if (rpath.startsWith('/sitemap')) {
    return sitemap(ctx);
  } else if (rpath.startsWith('/feed.ics')) {
    return icalFeed(ctx);
  } else if (rpath.length > 10) {
    const tail = rpath.substring(rpath.length - 10);
    if (reIsoDate.test(tail)) {
      ctx.state.trackPageview = true;
      return eventDetail(ctx, tail);
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
