const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSubdomain,
  planVercelDnsReconcile,
  reconcileVercelDns
} = require('../lib/point-at-site-dns');

describe('point-at-site-dns helpers', () => {
  it('normalizes apex and www subdomain shapes', () => {
    assert.equal(normalizeSubdomain('@', 'reconcileit.au'), '@');
    assert.equal(normalizeSubdomain('', 'reconcileit.au'), '@');
    assert.equal(normalizeSubdomain('reconcileit.au', 'reconcileit.au'), '@');
    assert.equal(normalizeSubdomain('www', 'reconcileit.au'), 'www');
    assert.equal(normalizeSubdomain('www.reconcileit.au', 'reconcileit.au'), 'www');
    assert.equal(normalizeSubdomain('mail', 'reconcileit.au'), 'mail');
  });

  it('plans deletion of parking A records and wrong www A', () => {
    const plan = planVercelDnsReconcile(
      [
        { id: 1, type: 'A', subdomain: '@', content: '216.150.1.1' },
        { id: 2, type: 'A', subdomain: '@', content: '27.124.125.173' },
        { id: 3, type: 'A', subdomain: 'www', content: '27.124.125.173' },
        { id: 4, type: 'MX', subdomain: '@', content: 'mail.example.com', priority: 10 },
        { id: 5, type: 'TXT', subdomain: '@', content: 'v=spf1' }
      ],
      {
        domainName: 'reconcileit.au',
        apexA: '76.76.21.21',
        wwwCname: 'cname.vercel-dns.com'
      }
    );
    assert.deepEqual(plan.deleteIds, [1, 2, 3]);
    assert.equal(plan.needApex, true);
    assert.equal(plan.needWww, true);
  });

  it('keeps correct Vercel records and only removes conflicts', () => {
    const plan = planVercelDnsReconcile(
      [
        { id: 10, type: 'A', subdomain: '@', content: '76.76.21.21' },
        { id: 11, type: 'A', subdomain: '@', content: '27.124.125.173' },
        { id: 12, type: 'CNAME', subdomain: 'www', content: 'cname.vercel-dns.com.' },
        { id: 13, type: 'A', subdomain: 'www.reconcileit.au', content: '27.124.125.173' }
      ],
      {
        domainName: 'reconcileit.au',
        apexA: '76.76.21.21',
        wwwCname: 'cname.vercel-dns.com'
      }
    );
    assert.deepEqual(plan.deleteIds, [11, 13]);
    assert.equal(plan.needApex, false);
    assert.equal(plan.needWww, false);
    assert.deepEqual(plan.keptApexIds, [10]);
    assert.deepEqual(plan.keptWwwIds, [12]);
  });

  it('treats apex WEBFWD / AAAA as conflicting', () => {
    const plan = planVercelDnsReconcile(
      [
        { id: 1, type: 'WEBFWD', subdomain: '@', forward_to: 'https://example.com' },
        { id: 2, type: 'AAAA', subdomain: '@', content: '::1' },
        { id: 3, type: 'CNAME', subdomain: 'www', content: 'elsewhere.com' }
      ],
      { domainName: 'x.au', apexA: '76.76.21.21', wwwCname: 'cname.vercel-dns.com' }
    );
    assert.deepEqual(plan.deleteIds, [1, 2, 3]);
    assert.equal(plan.needApex, true);
    assert.equal(plan.needWww, true);
  });
});

describe('reconcileVercelDns', () => {
  it('deletes conflicts then creates apex A and www CNAME', async () => {
    const calls = { delete: [], add: [] };
    const ds = {
      async listDomainDns() {
        return {
          ok: true,
          data: {
            data: [
              { id: 1, type: 'A', subdomain: '@', content: '27.124.125.173' },
              { id: 2, type: 'A', subdomain: 'www', content: '27.124.125.173' }
            ]
          }
        };
      },
      async deleteDomainDns(_id, rid) {
        calls.delete.push(rid);
        return { ok: true };
      },
      async addDomainDns(_id, rec) {
        calls.add.push(rec);
        return { ok: true };
      }
    };

    const result = await reconcileVercelDns(ds, 99, {
      domainName: 'reconcileit.au',
      apexA: '76.76.21.21',
      wwwCname: 'cname.vercel-dns.com'
    });

    assert.equal(result.ok, true);
    assert.deepEqual(calls.delete, [1, 2]);
    assert.deepEqual(calls.add, [
      { type: 'A', subdomain: '@', content: '76.76.21.21' },
      { type: 'CNAME', subdomain: 'www', content: 'cname.vercel-dns.com' }
    ]);
    assert.equal(result.apex.status, 'ok');
    assert.equal(result.www.status, 'ok');
    assert.deepEqual(result.removed, [1, 2]);
  });

  it('is idempotent when records already correct', async () => {
    const ds = {
      async listDomainDns() {
        return {
          ok: true,
          data: {
            data: [
              { id: 1, type: 'A', subdomain: '@', content: '76.76.21.21' },
              { id: 2, type: 'CNAME', subdomain: 'www', content: 'cname.vercel-dns.com' }
            ]
          }
        };
      },
      async deleteDomainDns() {
        throw new Error('should not delete');
      },
      async addDomainDns() {
        throw new Error('should not add');
      }
    };

    const result = await reconcileVercelDns(ds, 1, {
      domainName: 'ok.au',
      apexA: '76.76.21.21',
      wwwCname: 'cname.vercel-dns.com'
    });
    assert.equal(result.ok, true);
    assert.equal(result.apex.detail, 'already_set');
    assert.equal(result.www.detail, 'already_set');
    assert.deepEqual(result.removed, []);
  });
});
