'use strict';

const compress = require('koa-compress');
const dayjs = require('dayjs');
const error = require('koa-error');
const conditional = require('koa-conditional-get');
const etag = require('koa-etag');
const http = require('http');
const Koa = require('koa');
const koaLogger = require('koa-pino-logger');
const mmh3 = require('murmurhash3');
const path = require('path');
const render = require('koa-ejs');
const serve = require('koa-static');
const util = require('util');
const zlib = require('zlib');
const {basename} = require('path');
const {makeEvents, makeEventsFullCalendar, eventDetail, eventJsonLD} = require('./events');
const {makeHolidays} = require('./holidays');
const {icalFeed} = require('./feed');
const {sitemap} = require('./sitemap');

// return array that have 4 elements of 32bit integer
const murmur128 = util.promisify(mmh3.murmur128);

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


/**
* Middleware to track via Google Analytics only if
* `ctx.state.trackPageview === true && ctx.status === 200`
* @param {string} tid
* @return {function}
*/
function googleAnalytics4(tid) {
  return async function googleAnalytics4Pageview(ctx, next) {
    const userAgent = ctx.get('user-agent');
    const ipAddress = ctx.get('x-client-ip') || ctx.request.ip;
    const visitorId = ctx.state.visitorId = await makeUuid(ipAddress, userAgent, ctx.get('accept-language'));
    await next();
    if (ctx.state.trackPageview && ctx.status === 200) {
      const url = makeUrl(ctx);
      const postParams = new URLSearchParams({
        v: '2',
        tid: ctx.state.trackingId || tid,
        t: 'pageview',
        cid: visitorId,
        ua: userAgent,
        uip: ipAddress,
        dl: url,
      });

      const ref = ctx.get('referrer');
      if (ref) {
        postParams.set('dr', ref);
      }

      const postData = postParams.toString();

      const options = {
        hostname: 'www.google-analytics.com',
        port: 80,
        path: '/collect',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length,
        },
      };

      await new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          res.setEncoding('utf8');
          let responseBody = '';
          res.on('data', (chunk) => {
            responseBody += chunk;
          });
          res.on('end', () => {
            resolve(responseBody);
          });
        });
        req.on('error', (err) => {
          reject(err);
        });

        // write data to request body
        req.write(postData);
        req.end();
      });
    }
  };
}

/**
 * @private
 * @param {*} ctx
 * @return {string}
 */
function makeUrl(ctx) {
  const rpath = ctx.request.path;
  const proto = ctx.get('x-forwarded-proto') || 'http';
  const host = ctx.get('host') || 'www.pastafariancalendar.com';
  const qs = ctx.request.querystring;
  let url = `${proto}://${host}${rpath}`;
  if (qs && qs.length) {
    url += `?${qs}`;
  }
  return url;
}

/**
* @private
* @param {string} ipAddress
* @param {string} userAgent
* @param {string} acceptLanguage
* @return {string}
*/
async function makeUuid(ipAddress, userAgent, acceptLanguage) {
  const raw = await murmur128(ipAddress + userAgent + acceptLanguage);
  const buf32 = new Uint32Array(raw);
  const bytes = new Uint8Array(buf32.buffer);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  let digest = '';
  for (let i = 0; i < 16; i++) {
    digest += bytes[i].toString(16).padStart(2, '0');
    switch (i) {
      case 3:
      case 5:
      case 7:
      case 9:
        digest += '-';
        break;
      default:
        break;
    }
  }
  return digest;
}
