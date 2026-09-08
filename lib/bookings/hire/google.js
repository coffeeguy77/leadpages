'use strict';

/**
 * Google Calendar + Contacts integration for Bookings hire mode.
 * Leadpages is authoritative by default — remote edits are restored.
 */

const { encryptSecret, decryptSecret, encryptionConfigured } = require('./tokens');
const { applyTemplate, defaultEventTitleTemplate, resolveTerminology } = require('./terminology');

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const PEOPLE_API = 'https://people.googleapis.com/v1';

const SCOPES = {
  calendar: 'https://www.googleapis.com/auth/calendar.events',
  contacts: 'https://www.googleapis.com/auth/contacts'
};

function clientConfig() {
  return {
    clientId: process.env.GOOGLE_BOOKINGS_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_BOOKINGS_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    redirectUri:
      process.env.GOOGLE_BOOKINGS_REDIRECT_URI ||
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      ((process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.leadpages.com.au').replace(/\/$/, '') +
        '/api/bookings/google/callback')
  };
}

function buildAuthUrl(state, opts) {
  opts = opts || {};
  const cfg = clientConfig();
  if (!cfg.clientId) {
    const err = new Error('google_oauth_not_configured');
    err.code = 'not_configured';
    throw err;
  }
  const scopes = [];
  if (opts.calendar !== false) scopes.push(SCOPES.calendar);
  if (opts.contacts) scopes.push(SCOPES.contacts);
  const u = new URL(GOOGLE_AUTH);
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('redirect_uri', cfg.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', scopes.join(' '));
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('state', state);
  return u.toString();
}

async function exchangeCode(code) {
  const cfg = clientConfig();
  const body = new URLSearchParams({
    code: code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: 'authorization_code'
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error_description || json.error || 'token_exchange_failed');
    err.details = json;
    throw err;
  }
  return json;
}

async function refreshAccessToken(connection) {
  const cfg = clientConfig();
  const refresh = decryptSecret(connection.refresh_token_enc);
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refresh,
    grant_type: 'refresh_token'
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error_description || json.error || 'refresh_failed');
    err.details = json;
    throw err;
  }
  return json;
}

async function getValidAccessToken(admin, connection) {
  const expires = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;
  if (connection.access_token_enc && expires > Date.now() + 60000) {
    return decryptSecret(connection.access_token_enc);
  }
  const refreshed = await refreshAccessToken(connection);
  const patch = {
    access_token_enc: encryptSecret(refreshed.access_token),
    access_token_expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    last_error: '',
    sync_health: 'healthy'
  };
  if (refreshed.refresh_token) {
    patch.refresh_token_enc = encryptSecret(refreshed.refresh_token);
  }
  await admin.from('booking_google_connections').update(patch).eq('id', connection.id);
  Object.assign(connection, patch);
  return refreshed.access_token;
}

function eventFingerprint(payload) {
  return [
    payload.start && payload.start.dateTime,
    payload.end && payload.end.dateTime,
    payload.summary,
    payload.colorId || '',
    (payload.extendedProperties &&
      payload.extendedProperties.private &&
      payload.extendedProperties.private.leadpages_booking_id) ||
      ''
  ].join('|');
}

function buildCalendarEvent(system, booking, hire, resource, customer) {
  const terms = resolveTerminology(system);
  const title = applyTemplate(defaultEventTitleTemplate(system), {
    resource_name: (resource && (resource.public_name || resource.name)) || terms.singular,
    customer_name: (customer && customer.name) || booking.customer_name || 'Customer',
    booking_reference: booking.reference || booking.id
  });
  const tz = booking.timezone || system.timezone || 'Australia/Sydney';
  const start = hire.pickup_at || booking.starts_at;
  const end = hire.return_at || booking.ends_at;
  const description = [
    terms.booking + ': ' + (booking.reference || ''),
    terms.customer + ': ' + ((customer && customer.name) || booking.customer_name || ''),
    'Phone: ' + ((customer && customer.phone) || booking.customer_phone || ''),
    terms.singular + ': ' + ((resource && (resource.public_name || resource.name)) || ''),
    'Pickup: ' + start,
    'Return: ' + end,
    'Status: ' + booking.status,
    'Payment: ' + (booking.payment_status || '')
  ].join('\n');

  return {
    summary: title,
    description: description,
    start: { dateTime: start, timeZone: tz },
    end: { dateTime: end, timeZone: tz },
    colorId: undefined,
    extendedProperties: {
      private: {
        leadpages_tenant: system.site_id,
        leadpages_booking_id: booking.id,
        leadpages_booking_ref: booking.reference || '',
        leadpages_managed: '1',
        leadpages_version: String((hire && hire.meta && hire.meta.sync_version) || 1)
      }
    }
  };
}

async function upsertGoogleEvent(admin, connection, system, booking, hire, resource, customer) {
  const access = await getValidAccessToken(admin, connection);
  const calendarId = encodeURIComponent(connection.primary_calendar_id || 'primary');
  const payload = buildCalendarEvent(system, booking, hire, resource, customer);
  const fp = eventFingerprint(payload);

  const { data: link } = await admin
    .from('booking_google_event_links')
    .select('*')
    .eq('booking_id', booking.id)
    .maybeSingle();

  let res;
  let event;
  if (link && link.google_event_id) {
    res = await fetch(
      CALENDAR_API + '/calendars/' + calendarId + '/events/' + encodeURIComponent(link.google_event_id),
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + access,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );
  } else {
    res = await fetch(CALENDAR_API + '/calendars/' + calendarId + '/events', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + access,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  }
  event = await res.json();
  if (!res.ok) {
    await admin
      .from('booking_google_connections')
      .update({
        last_error: event.error && event.error.message ? event.error.message : 'event_upsert_failed',
        sync_health: 'error',
        last_attempted_sync_at: new Date().toISOString()
      })
      .eq('id', connection.id);
    return { ok: false, error: event };
  }

  const row = {
    booking_id: booking.id,
    booking_system_id: system.id,
    site_id: system.site_id,
    google_calendar_id: connection.primary_calendar_id || 'primary',
    google_event_id: event.id,
    etag: event.etag || '',
    fingerprint: fp,
    sync_version: (link && link.sync_version ? link.sync_version : 0) + 1,
    last_leadpages_modified_at: new Date().toISOString(),
    last_google_modified_at: event.updated || null,
    last_successful_sync_at: new Date().toISOString(),
    last_attempted_sync_at: new Date().toISOString(),
    sync_status: 'synced',
    sync_error: '',
    managed: true,
    updated_at: new Date().toISOString()
  };

  if (link) {
    await admin.from('booking_google_event_links').update(row).eq('id', link.id);
  } else {
    await admin.from('booking_google_event_links').insert(row);
  }

  await admin
    .from('booking_hire_details')
    .update({
      google_event_id: event.id,
      google_calendar_id: row.google_calendar_id,
      google_sync_status: 'synced',
      google_sync_error: '',
      google_etag: event.etag || '',
      google_last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('booking_id', booking.id);

  return { ok: true, event: event, fingerprint: fp };
}

/**
 * Leadpages-authoritative restore when Google event was moved/resized/deleted.
 */
async function reconcileManagedEvent(admin, connection, system, link, remoteEvent, booking, hire, resource, customer) {
  const authority = connection.calendar_authority || 'leadpages';
  const localPayload = buildCalendarEvent(system, booking, hire, resource, customer);
  const localFp = eventFingerprint(localPayload);

  if (!remoteEvent || remoteEvent.status === 'cancelled') {
    if (authority === 'leadpages') {
      // recreate
      await admin.from('booking_google_event_links').delete().eq('id', link.id);
      return upsertGoogleEvent(admin, connection, system, booking, hire, resource, customer);
    }
    await admin
      .from('booking_google_sync_conflicts')
      .insert({
        booking_system_id: system.id,
        site_id: system.site_id,
        booking_id: booking.id,
        google_event_id: link.google_event_id,
        conflict_type: 'deleted_remote',
        leadpages_snapshot: localPayload,
        google_snapshot: remoteEvent || {},
        status: 'open'
      });
    return { ok: true, action: 'conflict_recorded' };
  }

  const remoteFp = eventFingerprint({
    start: remoteEvent.start,
    end: remoteEvent.end,
    summary: remoteEvent.summary,
    colorId: remoteEvent.colorId,
    extendedProperties: remoteEvent.extendedProperties
  });

  if (remoteFp === localFp || remoteFp === link.fingerprint) {
    return { ok: true, action: 'in_sync' };
  }

  if (authority === 'leadpages') {
    await admin.from('booking_google_sync_conflicts').insert({
      booking_system_id: system.id,
      site_id: system.site_id,
      booking_id: booking.id,
      google_event_id: link.google_event_id,
      conflict_type: 'external_edit',
      leadpages_snapshot: localPayload,
      google_snapshot: remoteEvent,
      status: 'restored'
    });
    await admin.from('booking_hire_lock_events').insert({
      booking_id: booking.id,
      booking_system_id: system.id,
      site_id: system.site_id,
      action: 'google_restore',
      reason: 'Authoritative restore after Google edit',
      previous_values: { remote: remoteEvent },
      new_values: { local: localPayload }
    });
    return upsertGoogleEvent(admin, connection, system, booking, hire, resource, customer);
  }

  if (authority === 'two_way_approval') {
    await admin.from('booking_google_sync_conflicts').insert({
      booking_system_id: system.id,
      site_id: system.site_id,
      booking_id: booking.id,
      google_event_id: link.google_event_id,
      conflict_type: 'external_edit',
      leadpages_snapshot: localPayload,
      google_snapshot: remoteEvent,
      status: 'open'
    });
    return { ok: true, action: 'pending_approval' };
  }

  // google_allowed — still validate before applying (caller handles)
  return { ok: true, action: 'remote_diff', remote: remoteEvent, local: localPayload };
}

async function upsertGoogleContact(admin, connection, system, customer) {
  if (!connection.contacts_enabled) return { ok: false, error: 'contacts_disabled' };
  if (connection.contacts_direction === 'disabled') return { ok: false, error: 'contacts_disabled' };
  const access = await getValidAccessToken(admin, connection);
  const { data: existing } = await admin
    .from('booking_google_contact_links')
    .select('*')
    .eq('customer_id', customer.id)
    .maybeSingle();

  const person = {
    names: [{ givenName: customer.name || 'Customer' }],
    emailAddresses: customer.email ? [{ value: customer.email }] : [],
    phoneNumbers: customer.phone ? [{ value: customer.phone }] : []
  };

  let res;
  if (existing && existing.google_resource_name) {
    res = await fetch(PEOPLE_API + '/' + existing.google_resource_name + ':updateContact?updatePersonFields=names,emailAddresses,phoneNumbers', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + access,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(person)
    });
  } else {
    res = await fetch(PEOPLE_API + '/people:createContact', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + access,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(person)
    });
  }
  const json = await res.json();
  if (!res.ok) return { ok: false, error: json };
  const resourceName = json.resourceName;
  const row = {
    booking_system_id: system.id,
    site_id: system.site_id,
    customer_id: customer.id,
    google_resource_name: resourceName,
    etag: json.etag || '',
    last_synced_at: new Date().toISOString(),
    sync_status: 'synced'
  };
  if (existing) await admin.from('booking_google_contact_links').update(row).eq('id', existing.id);
  else await admin.from('booking_google_contact_links').insert(row);
  return { ok: true, resourceName: resourceName };
}

function connectionPublicView(conn) {
  if (!conn) return null;
  return {
    id: conn.id,
    google_account_email: conn.google_account_email,
    calendar_enabled: conn.calendar_enabled,
    contacts_enabled: conn.contacts_enabled,
    primary_calendar_id: conn.primary_calendar_id,
    calendar_authority: conn.calendar_authority,
    contacts_direction: conn.contacts_direction,
    sync_interval_minutes: conn.sync_interval_minutes,
    event_title_template: conn.event_title_template,
    last_successful_sync_at: conn.last_successful_sync_at,
    last_attempted_sync_at: conn.last_attempted_sync_at,
    last_error: conn.last_error,
    sync_health: conn.sync_health,
    connected_at: conn.connected_at,
    encryption_ready: encryptionConfigured()
  };
}

module.exports = {
  SCOPES,
  clientConfig,
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getValidAccessToken,
  buildCalendarEvent,
  eventFingerprint,
  upsertGoogleEvent,
  reconcileManagedEvent,
  upsertGoogleContact,
  connectionPublicView,
  encryptSecret,
  decryptSecret,
  encryptionConfigured
};
