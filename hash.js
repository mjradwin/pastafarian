import {murmur128Sync} from 'murmurhash3';

export function murmur128SyncBase64(str) {
  const arr4 = murmur128Sync(str);
  const int32Array = new Uint32Array(arr4);
  const buffer = Buffer.from(int32Array.buffer);
  const base64String = buffer.toString('base64url');
  return base64String;
}
