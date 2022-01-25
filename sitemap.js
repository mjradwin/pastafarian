'use strict';
/* eslint-disable require-jsdoc */

Object.defineProperty(exports, '__esModule', {value: true});

const dayjs = require('dayjs');
const {basename} = require('path');
const {makeEvent} = require('./events');

const baseUrl = 'https://www.pastafariancalendar.com';

async function sitemap(ctx) {
  const page = basename(ctx.request.path);
  ctx.body = (page === 'sitemap.xml') ? sitemapIndex() : sitemapYear(page);
  ctx.lastModified = new Date();
  ctx.set('Cache-Control', 'public, max-age=604800'); // 7 days
  ctx.type = 'text/xml; charset=utf-8';
}

function sitemapIndex() {
  let body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
  const now = new Date();
  const lastmod = now.toISOString();
  const startYear = now.getFullYear();
  const endYear = startYear + 5;
  for (let year = startYear; year <= endYear; year++) {
    body += `<sitemap>
  <loc>${baseUrl}/sitemap-${year}.xml</loc>
  <lastmod>${lastmod}</lastmod>
</sitemap>
`;
  }
  body += '</sitemapindex>\n';
  return body;
}

function sitemapYear(page) {
  const matches = /(\d\d\d\d)\.xml$/.exec(page);
  const now = new Date();
  let year = now.getFullYear();
  if (matches) {
    year = +(matches[1]);
  }
  const lastmod = now.toISOString();
  const startDt = dayjs(new Date(year, 0, 1));
  const endDt = dayjs(new Date(year + 1, 0, 1));
  let body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
  for (let d = startDt; d.isBefore(endDt); d = d.add(1, 'day')) {
    const event = makeEvent(d);
    body += `<url>\n <loc>https://www.pastafariancalendar.com${event.url}</loc>\n`;
    body += ` <lastmod>${lastmod}</lastmod>\n`;
    body += '</url>\n';
  }
  body += '</urlset>\n';
  return body;
}

exports.sitemap = sitemap;