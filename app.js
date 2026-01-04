import compress from 'koa-compress';
import error from 'koa-error';
import xResponseTime from 'koa-better-response-time';
import conditional from 'koa-conditional-get';
import Koa from 'koa';
import koaLogger from 'koa-pino-logger';
import path, {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import render from '@koa/ejs';
import serve from 'koa-static';
import zlib from 'node:zlib';
import {homepage} from './homepage.js';
import {eventsFcJsonApp} from './fullcalendar.js';
import {eventDetailApp} from './eventDetail.js';
import {holidaysJsonApp} from './holidays.js';
import {icalFeed} from './feed.js';
import {sitemap} from './sitemap.js';
import {matomoTrack} from './analytics.js';
import {makeETag} from './etag.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new Koa();

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
    ctx.body = 'User-agent: *\nAllow: /\n';
    return;
  } else if (rpath === '/i' || rpath === '/i/') {
    return ctx.render('dir-hidden');
  } else if (rootDirStatic.has(rpath) || rpath.startsWith('/i/') || rpath.endsWith('.png')) {
    ctx.set('Cache-Control', CACHE_CONTROL_IMMUTABLE);
    // let serve() handle this file
  } else if (rpath === '/') {
    return homepage(ctx);
  } else if (rpath.startsWith('/holidays') && rpath.endsWith('.json')) {
    return holidaysJsonApp(ctx);
  } else if (rpath === '/privacy' || rpath === '/about' || rpath === '/holidays') {
    const page = basename(rpath);
    ctx.set('Cache-Control', 'public');
    matomoTrack(ctx, rpath.substring(1));
    ctx.response.etag = makeETag(ctx, {});
    ctx.status = 200;
    if (ctx.fresh) {
      ctx.status = 304;
      return;
    }
    return ctx.render(page);
  } else if (rpath.startsWith('/events.json')) {
    return eventsFcJsonApp(ctx);
  } else if (rpath.startsWith('/sitemap')) {
    return sitemap(ctx);
  } else if (rpath.startsWith('/feed.ics')) {
    return icalFeed(ctx);
  } else if (rpath.length > 10) {
    const tail = rpath.substring(rpath.length - 10);
    if (reIsoDate.test(tail)) {
      return eventDetailApp(ctx);
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
