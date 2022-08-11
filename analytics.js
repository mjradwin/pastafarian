const http = require('node:http');
const mmh3 = require('murmurhash3');
const util = require('util');
const pkg = require('./package.json');

// return array that have 4 elements of 32bit integer
const murmur128 = util.promisify(mmh3.murmur128);

const knownRobots = {
  'Mediapartners-Google': 1,
  'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)': 1,
  'Mozilla/5.0 (compatible; BLEXBot/1.0; +http://webmeup-crawler.com/)': 1,
  'Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot; help@moz.com)': 1,
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)': 1,
  'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)': 1,
  'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)': 1,
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)': 1,
  'Rainmeter WebParser plugin': 1,
  'Varnish Health Probe': 1,
  'check_http/v2.2 (monitoring-plugins 2.2)': 1,
  'kube-probe/1.21': 1,
};

/**
 * @param {*} ctx
 * @param {string} pageTitle
 * @param {*} [params={}]
 */
async function matomoTrack(ctx, pageTitle, params={}) {
  const userAgent = ctx.get('user-agent');
  if (knownRobots[userAgent]) {
    return false;
  }
  const args = new URLSearchParams(params);
  args.set('action_name', pageTitle);
  args.set('idsite', '2');
  args.set('rec', '1');
  args.set('apiv', '1');
  args.set('send_image', '0'); // prefer HTTP 204 instead of a GIF image
  args.set('url', ctx.request.href);
  const pvId = await makePageviewId(ctx);
  args.set('pv_id', pvId);
  args.set('ua', userAgent);
  const lang = ctx.get('accept-language');
  if (lang && lang.length) {
    args.set('lang', lang);
  }
  const ref = ctx.get('referer');
  if (ref && ref.length) {
    args.set('urlref', ref);
  }
  const postData = args.toString();
  const xfwd = ctx.get('x-forwarded-for') || ctx.request.ip;
  const ips = xfwd.split(',');
  const ipAddress = ips[0];
  const headers = {
    'Host': 'www.hebcal.com',
    'X-Forwarded-For': xfwd,
    'X-Client-IP': ipAddress,
    'X-Forwarded-Proto': 'https',
    'User-Agent': pkg.name + '/' + pkg.version,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData),
  };
  if (ref && ref.length) {
    headers.Referer = ref;
  }
  const options = {
    hostname: 'www.hebcal.com',
    port: 80,
    path: '/ma/ma.php',
    method: 'POST',
    headers: headers,
  };
  console.log(`matomo: ${postData}&clientIp=${ipAddress}`);
  const req = http.request(options);
  req.on('error', (err) => {
    console.error(err);
  });
  req.write(postData);
  req.end();
}

/**
 * @param {any} ctx
 * @return {string}
 */
async function makePageviewId(ctx) {
  const userAgent = ctx.get('user-agent');
  const ipAddress = ctx.get('x-forwarded-for') || ctx.request.ip;
  const acceptLanguage = ctx.get('accept-language');
  const raw = await murmur128(Date.now() + ipAddress + userAgent + acceptLanguage);
  const buf32 = new Uint32Array(raw);
  const bytes = new Uint8Array(buf32.buffer);
  const buff = Buffer.from(bytes);
  const qs = buff.toString('base64');
  return qs.replace(/[\+\/]/g, '').substring(0, 6);
}

exports.matomoTrack = matomoTrack;
