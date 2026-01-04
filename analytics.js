import http from 'node:http';
import pkg from './package.json' with {type: "json"};

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
export function matomoTrack(ctx, pageTitle, params={}) {
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
  args.set('ua', userAgent);
  const lang = ctx.get('accept-language');
  if (lang?.length) {
    args.set('lang', lang);
  }
  const ref = ctx.get('referer');
  if (ref?.length) {
    args.set('urlref', ref);
  }
  const duration = Date.now() - ctx.state.startTime;
  args.set('pf_srv', duration);
  const utmSource = ctx.request?.query?.utm_source;
  if (utmSource) {
    args.set('_rcn', utmSource);
  }
  const postData = args.toString();
  const postLen = Buffer.byteLength(postData);
  let path = '/ma/matomo.php';
  let sendPostBody = true;
  if (postLen < 4000) {
    path += '?' + postData;
    sendPostBody = false;
  }
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
    'Content-Length': sendPostBody ? postLen : 0,
  };
  if (ref?.length) {
    headers.Referer = ref;
  }
  const options = {
    hostname: 'www.hebcal.com',
    port: 80,
    path: path,
    method: 'POST',
    headers: headers,
  };
  console.log(`matomo: ${postData}&clientIp=${ipAddress}`);
  const req = http.request(options);
  req.on('error', (err) => {
    console.error(err);
  });
  if (sendPostBody) {
    req.write(postData);
  }
  req.end();
}
