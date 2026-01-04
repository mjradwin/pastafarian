import {murmur128SyncBase64} from './hash.js';
import pkg from './package.json' with {type: "json"};

/**
 * @param {any} ctx
 * @param {Object.<string,string>} attrs
 * @return {string}
 */
export function makeETag(ctx, attrs) {
  const etagObj = {web: pkg.version, ...attrs, path: ctx.request.path};
  const utm = Object.keys(etagObj).filter((k) => k.startsWith('utm_'));
  for (const key of utm) {
    delete etagObj[key];
  }
  const enc = ctx.get('accept-encoding');
  if (enc) {
    if (enc.includes('br')) {
      etagObj.br = 1;
    } else if (enc.includes('gzip')) {
      etagObj.gzip = 1;
    }
  }
  const str = JSON.stringify(etagObj);
  const base64String = murmur128SyncBase64(str);
  return `W/"${base64String}"`;
}

