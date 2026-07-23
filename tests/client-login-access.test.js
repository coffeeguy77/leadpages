'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const clientAccess = fs.readFileSync(path.join(root, 'api/auth/client-access.js'), 'utf8');
const clientHelpers = fs.readFileSync(path.join(root, 'api/auth/_client-login.js'), 'utf8');
const owner = fs.readFileSync(path.join(root, 'api/billing/owner.js'), 'utf8');
const status = fs.readFileSync(path.join(root, 'api/billing/status.js'), 'utf8');

describe('Client editing login vs super-admin password', () => {
  it('exposes a dedicated client-access API separate from session updateUser', () => {
    assert.match(clientAccess, /action === 'setpassword'/i);
    assert.match(clientAccess, /setUserPassword/);
    assert.match(clientAccess, /findOrCreateUser/);
    assert.match(clientAccess, /never allow this endpoint to target the caller's own auth user/i);
    assert.match(clientHelpers, /admin\/users/);
    assert.ok(fs.existsSync(path.join(root, 'api/auth/client-access.js')));
  });

  it('Account UI separates your password from client editing login', () => {
    assert.match(manage, /Your LeadPages login/);
    assert.match(manage, /does <strong>not<\/strong> change a customer/);
    assert.match(manage, /Client editing login/);
    assert.match(manage, /wireClientAccessCard/);
    assert.match(manage, /\/api\/auth\/client-access/);
    assert.match(manage, /action:'setPassword'/);
    assert.match(manage, /Save client password/);
    assert.match(manage, /Save your password/);
  });

  it('auto-provisions client auth user on publish so OTP works', () => {
    assert.match(manage, /action:'ensure'/);
    assert.match(manage, /Provision editing login for Client login email/);
  });

  it('billing owner re-links when email changes instead of early-return', () => {
    assert.doesNotMatch(owner, /if \(site\.owner_user_id\) return json/);
    assert.match(owner, /findOrCreateUser/);
    assert.match(owner, /Client login email cannot be a super-admin/);
  });

  it('locks editor only for suspended hosted sites; building stays open', () => {
    assert.match(status, /siteIsHostingLocked/);
    assert.match(status, /focusSiteId/);
    assert.match(status, /Building \/ no plan_key/);
    assert.match(manage, /lpBillingGate/);
    assert.match(manage, /\/api\/billing\/status'\+sid/);
    assert.match(manage, /Go to billing \/ pay/);
    assert.match(manage, /location\.href='\/billing'/);
  });

  it('login copy points at Client login email for sign-in codes', () => {
    assert.match(manage, /Client login email<\/strong> \(from the project Settings\)/);
    assert.match(manage, /editing login for this project only/);
  });
});
