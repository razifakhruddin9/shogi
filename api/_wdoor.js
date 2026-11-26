export const WDOOR_INDEX_URL = 'https://wdoor.c.u-tokyo.ac.jp/shogi/';
export const WDOOR_TODAY_URL = 'https://wdoor.c.u-tokyo.ac.jp/shogi/x/today';

export const DEFAULT_CATALOG = [
  { year: '2026', file: 'wdoor2026.7z', sizeLabel: '93 MB' },
  { year: '2025', file: 'wdoor2025.7z', sizeLabel: '335 MB' },
  { year: '2024', file: 'wdoor2024.7z', sizeLabel: '338 MB' },
  { year: '2023', file: 'wdoor2023.7z', sizeLabel: '339 MB' },
  { year: '2022', file: 'wdoor2022.7z', sizeLabel: '290 MB' },
  { year: '2021', file: 'wdoor2021.7z', sizeLabel: '352 MB' },
  { year: '2020', file: 'wdoor2020.7z', sizeLabel: '337 MB' },
  { year: '2019', file: 'wdoor2019.7z', sizeLabel: '217 MB' },
  { year: '2018', file: 'wdoor2018.7z', sizeLabel: '107 MB' },
  { year: '2017', file: 'wdoor2017.7z', sizeLabel: '184 MB' },
  { year: '2016', file: 'wdoor2016.7z', sizeLabel: '217 MB' },
  { year: '2015', file: 'wdoor2015.7z', sizeLabel: '182 MB' },
  { year: '2014', file: 'wdoor2014.7z', sizeLabel: '159 MB' },
  { year: '2013', file: 'wdoor2013.7z', sizeLabel: '222 MB' },
  { year: '2012', file: 'wdoor2012.7z', sizeLabel: '167 MB' },
  { year: '2011', file: 'wdoor2011.7z', sizeLabel: '105 MB' },
  { year: '2010', file: 'wdoor2010.7z', sizeLabel: '132 MB' },
  { year: '2009', file: 'wdoor2009.7z', sizeLabel: '85 MB' },
  { year: '2008', file: 'wdoor2008.7z', sizeLabel: '59 MB' },
];

export async function parseVercelBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 500_000) raw = '';
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}
