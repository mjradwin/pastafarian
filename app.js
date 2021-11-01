'use strict';

const compress = require('koa-compress');
const dayjs = require('dayjs');
const error = require('koa-error');
const Koa = require('koa');
const koaLogger = require('koa-pino-logger');
const path = require('path');
const render = require('koa-ejs');
const serve = require('koa-static');
const zlib = require('zlib');
const {basename} = require('path');
const {makeEvents, makeEvent, eventDetail} = require('./events');
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

const CACHE_CONTROL_IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';

const reIsoDate = /^\d\d\d\d-\d\d-\d\d$/;

app.use(async function router(ctx, next) {
  const rpath = ctx.request.path;
  if (rpath === '/robots.txt') {
    ctx.lastModified = ctx.launchDate;
    ctx.body = 'User-agent: *\nAllow: /\n';
    return;
  } else if (rpath === '/ping') {
    ctx.type = 'text/plain';
    // let serve() handle this file
  } else if (rpath === '/i' || rpath === '/i/') {
    ctx.lastModified = ctx.launchDate;
    return ctx.render('dir-hidden');
  } else if (rpath === '/favicon.ico' || rpath.startsWith('/i/') || rpath.endsWith('.png')) {
    ctx.set('Cache-Control', CACHE_CONTROL_IMMUTABLE);
    // let serve() handle this file
  } else if (rpath === '/') {
    const today = dayjs();
    const ev = makeEvent(today);
    ctx.set('Cache-Control', 'private');
    return ctx.render('homepage', {
      today,
      ev,
    });
  } else if (rpath === '/privacy' || rpath === '/about') {
    const page = basename(rpath);
    ctx.set('Cache-Control', 'public');
    return ctx.render(page);
  } else if (rpath.startsWith('/events.json')) {
    ctx.lastModified = new Date();
    ctx.set('Cache-Control', 'public, max-age=604800'); // 7 days
    const q = ctx.request.query;
    ctx.body = makeEvents(q.start, q.end);
    return;
  } else if (rpath.startsWith('/sitemap')) {
    return sitemap(ctx);
  } else if (rpath.startsWith('/feed.ics')) {
    return icalFeed(ctx);
  } else if (rpath.length > 10) {
    const tail = rpath.substring(rpath.length - 10);
    if (reIsoDate.test(tail)) {
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
