/**
 * Dynamic robots.txt — platform rules on leadpages.* hosts; tenant rules on custom domains.
 */
const {
  isTenantCustomDomain,
  tenantRobotsTxt,
  platformRobotsTxt,
  originFromReq,
  resolvePrimaryHosts,
} = require('../lib/tenant-domain-seo');

module.exports = async (req, res) => {
  const origin = originFromReq(req);
  const custom = isTenantCustomDomain(
    req.headers['x-forwarded-host'] || req.headers.host,
    resolvePrimaryHosts(process.env.PRIMARY_HOSTS)
  );
  const body = custom ? tenantRobotsTxt(origin) : platformRobotsTxt();

  res.statusCode = 200;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', custom ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'public, s-maxage=3600');
  res.end(body);
};
