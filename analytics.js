const http = require('http');
const mmh3 = require('murmurhash3');
const util = require('util');

// return array that have 4 elements of 32bit integer
const murmur128 = util.promisify(mmh3.murmur128);

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

exports.googleAnalytics4 = googleAnalytics4;
