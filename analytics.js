const https = require('node:https');
const mmh3 = require('murmurhash3');
const util = require('util');

// return array that have 4 elements of 32bit integer
const murmur128 = util.promisify(mmh3.murmur128);

/**
 * @param {*} ctx
 * @param {string} pageTitle
 * @param {*} [params={}]
 */
async function matomoTrack(ctx, pageTitle, params={}) {
  const args = new URLSearchParams(params);
  args.set('action_name', pageTitle);
  args.set('idsite', '2');
  args.set('rec', '1');
  args.set('apiv', '1');
  args.set('send_image', '0'); // prefer HTTP 204 instead of a GIF image
  args.set('url', ctx.request.href);
  const pvId = await makePageviewId(ctx);
  args.set('pv_id', pvId);
  args.set('ua', ctx.get('user-agent'));
  const lang = ctx.get('accept-language');
  if (lang && lang.length) {
    args.set('lang', lang);
  }
  const ref = ctx.get('referer');
  if (ref && ref.length) {
    args.set('urlref', ref);
  }
  const postData = args.toString();
  const ip = ctx.get('x-client-ip') || ctx.request.ip;
  const options = {
    hostname: 'www.hebcal.com',
    port: 443,
    path: '/ma/ma.php',
    method: 'POST',
    headers: {
      'Host': 'www.hebcal.com',
      'X-Forwarded-For': ip,
      'X-Forwarded-Proto': 'https',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };
  console.log(`matomo: ${postData}`);
  const req = https.request(options);
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
  const ipAddress = ctx.get('x-client-ip') || ctx.request.ip;
  const acceptLanguage = ctx.get('accept-language');
  const raw = await murmur128(Date.now() + ipAddress + userAgent + acceptLanguage);
  const buf32 = new Uint32Array(raw);
  const bytes = new Uint8Array(buf32.buffer);
  const buff = Buffer.from(bytes);
  const qs = buff.toString('base64');
  return qs.replace(/[\+\/]/g, '').substring(0, 6);
}

exports.matomoTrack = matomoTrack;
