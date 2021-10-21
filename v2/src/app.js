import compress from 'koa-compress';
import error from 'koa-error';
import Koa from 'koa';
import koaLogger from 'koa-pino-logger';
import path from 'path';
import pino from 'pino';
import render from 'koa-ejs';
import serve from 'koa-static';
import zlib from 'zlib';
import { makeEvents } from './events';

const isProduction = process.env.NODE_ENV === 'production';
const DOCUMENT_ROOT = isProduction ? '/var/www/html' : path.join(__dirname, '..', 'static');

const app = new Koa();
app.context.launchDate = new Date();

const logDir = isProduction ? '/var/log/koa' : '.';
/*
const transport = pino.transport({
  target: 'pino/file',
  level: isProduction ? 'info' : 'debug',
  options: {destination: logDir + '/access.log'},
});
*/
const destination = pino.destination({
  dest: logDir + '/access.log',
  level: isProduction ? 'info' : 'debug',
});

app.use(koaLogger(destination));

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

const reIsoDate = /^\d\d\d\d-\d\d-\d\d/;

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
  } else if (rpath === '/favicon.ico' || rpath.startsWith('/i/') || rpath === '/apple-touch-icon.png') {
    ctx.state.trackPageview = false;
    ctx.set('Cache-Control', CACHE_CONTROL_IMMUTABLE);
    // let serve() handle this file
  } else if (rpath === '/') {
    return ctx.render('homepage', {
      title: 'Pastafarian Holy Days 🙏 🏴‍☠️ 🍝 | Pastafarian Calendar',
    });
  } else if (rpath.startsWith('/events.json')) {
    ctx.lastModified = new Date();
    const q = ctx.request.query;
    ctx.body = makeEvents(q.start, q.end);
    return;
  } else if (rpath.startsWith('/2')) {
  }
  await next();
});

app.use(serve(DOCUMENT_ROOT, {defer: false}));

const port = process.env.NODE_PORT || 8080;
app.listen(port, () => {
  const msg = 'Koa server listening on port ' + port;
  console.log(msg);
});
