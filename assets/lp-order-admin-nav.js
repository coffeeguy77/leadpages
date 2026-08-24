/**
 * Orders admin sidebar navigation tree (industry-neutral LeadPages marketplace app).
 * Used by orders.html and node tests.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.LpOrderNav = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** @typedef {{ id: string, label: string, route: string, badge?: string, hidden?: boolean, requiresPayments?: boolean, requiresDeposits?: boolean, superAdmin?: boolean }} NavLeaf */
  /** @typedef {{ id: string, label: string, icon: string, type: 'item'|'group', route?: string, badge?: string, hidden?: boolean, requiresPayments?: boolean, children?: NavLeaf[] }} NavNode */

  var NAV_TREE = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', type: 'item', route: 'dashboard' },
    {
      id: 'orders',
      label: 'Orders',
      icon: 'orders',
      type: 'group',
      children: [
        { id: 'orders-list', label: 'All Orders', route: 'orders', badge: 'orders_new' },
        { id: 'new', label: 'New Order', route: 'new' },
        { id: 'changes', label: 'Change Requests', route: 'changes' }
      ]
    },
    { id: 'calendar', label: 'Schedule', icon: 'calendar', type: 'item', route: 'calendar' },
    { id: 'supply', label: 'Supply & Preparation', icon: 'supply', type: 'item', route: 'supply' },
    { id: 'products', label: 'Products', icon: 'catalogue', type: 'item', route: 'products' },
    { id: 'customers', label: 'Customers', icon: 'customers', type: 'item', route: 'customers' },
    {
      id: 'payments',
      label: 'Payments',
      icon: 'payments',
      type: 'item',
      route: 'payments',
      requiresPayments: true,
      badge: 'awaiting_deposit'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      type: 'group',
      children: [
        { id: 'settings-order-setup', label: 'Order Setup', route: 'settings-cart' },
        { id: 'settings-schedule', label: 'Schedule & Opening Hours', route: 'settings-schedule' },
        { id: 'settings-rules', label: 'Order Rules', route: 'settings-general' },
        { id: 'settings-tax-payments', label: 'Tax & Payments', route: 'settings-payments' },
        { id: 'settings-store', label: 'Store Configuration', route: 'settings-store' },
        { id: 'messaging', label: 'Messaging', route: 'messaging' },
        { id: 'abandoned', label: 'Abandoned Carts', route: 'abandoned', badge: 'abandoned_carts' },
        { id: 'import', label: 'Import', route: 'import' }
      ]
    }
  ];

  var ROUTE_META = {
    dashboard: { view: 'dashboard', label: 'Dashboard', group: null },
    orders: { view: 'orders', label: 'All Orders', group: 'orders' },
    new: { view: 'new', label: 'New Order', group: 'orders' },
    changes: { view: 'changes', label: 'Change Requests', group: 'orders' },
    calendar: { view: 'calendar', label: 'Schedule', group: null },
    supply: { view: 'supply', label: 'Supply & Preparation', group: null },
    products: { view: 'products', label: 'Products', group: null },
    customers: { view: 'customers', label: 'Customers', group: null },
    payments: { view: 'payments', label: 'Payments', group: null },
    messaging: { view: 'messaging', label: 'Messaging', group: 'settings' },
    abandoned: { view: 'abandoned', label: 'Abandoned Carts', group: 'settings' },
    import: { view: 'import', label: 'Import', group: 'settings' },
    'settings-cart': { view: 'settings', label: 'Order Setup', group: 'settings', settingsSection: 'order-setup' },
    'settings-schedule': { view: 'settings', label: 'Schedule & Opening Hours', group: 'settings', settingsSection: 'schedule' },
    'settings-general': { view: 'settings', label: 'Order Rules', group: 'settings', settingsSection: 'rules' },
    'settings-payments': { view: 'settings', label: 'Tax & Payments', group: 'settings', settingsSection: 'tax-payments' },
    'settings-store': { view: 'settings', label: 'Store Configuration', group: 'settings', settingsSection: 'store' },
    'settings-gst': { view: 'settings', label: 'Tax & Payments', group: 'settings', settingsSection: 'tax-payments' }
  };

  var ICONS = {
    dashboard:
      '<svg class="oanav-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.75"/><rect x="13" y="3" width="8" height="5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.75"/><rect x="13" y="10" width="8" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.75"/><rect x="3" y="13" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.75"/></svg>',
    orders:
      '<svg class="oanav-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10l2 4H5l2-4Z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M9 12h6M9 16h4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>',
    calendar:
      '<svg class="oanav-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M8 3v4M16 3v4M3 10h18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>',
    supply:
      '<svg class="oanav-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h7" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="m16 14 2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    catalogue:
      '<svg class="oanav-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M18 17h2v2h-2v-2Z" fill="currentColor"/></svg>',
    customers:
      '<svg class="oanav-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><circle cx="17" cy="9" r="2.5" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M15 19c.3-2 1.8-3.5 4-3.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>',
    payments:
      '<svg class="oanav-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M2 10h20" fill="none" stroke="currentColor" stroke-width="1.75"/></svg>',
    settings:
      '<svg class="oanav-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>',
    chevron:
      '<svg class="oanav-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function routeMeta(route) {
    return ROUTE_META[route] || null;
  }

  function parentGroupForRoute(route) {
    var meta = routeMeta(route);
    return meta && meta.group ? meta.group : null;
  }

  function viewIdForRoute(route) {
    var meta = routeMeta(route);
    return meta ? meta.view : route;
  }

  function labelForRoute(route) {
    var meta = routeMeta(route);
    return meta ? meta.label : route;
  }

  function flattenVisibleTree(ctx) {
    ctx = ctx || {};
    var out = [];
    NAV_TREE.forEach(function (node) {
      if (!isNodeVisible(node, ctx)) return;
      if (node.type === 'item') {
        out.push({
          route: node.route,
          label: node.label,
          group: null,
          icon: node.icon || 'dashboard',
          badge: node.badge || null
        });
        return;
      }
      var children = (node.children || []).filter(function (c) {
        return isLeafVisible(c, ctx, node);
      });
      if (!children.length) return;
      out.push({ id: node.id, label: node.label, group: node.id, children: children });
    });
    return out;
  }

  function isNodeVisible(node, ctx) {
    if (node.hidden) return false;
    if (node.requiresPayments && !ctx.paymentsEnabled) return false;
    if (node.superAdmin && !ctx.isSuper) return false;
    if (node.type === 'group') {
      return (node.children || []).some(function (c) {
        return isLeafVisible(c, ctx, node);
      });
    }
    return true;
  }

  function isLeafVisible(leaf, ctx, parent) {
    if (leaf.hidden) return false;
    if (leaf.superAdmin && !ctx.isSuper) return false;
    if ((leaf.requiresPayments || (parent && parent.requiresPayments)) && !ctx.paymentsEnabled) return false;
    if (leaf.requiresDeposits && !ctx.depositsEnabled) return false;
    return !!routeMeta(leaf.route);
  }

  function aggregateGroupBadge(groupId, badges) {
    badges = badges || {};
    if (groupId === 'orders') {
      return sumBadges(badges, ['orders_new']);
    }
    if (groupId === 'settings') {
      return sumBadges(badges, ['abandoned_carts']);
    }
    return 0;
  }

  function sumBadges(badges, keys) {
    var n = 0;
    keys.forEach(function (k) {
      var v = Number(badges[k]);
      if (isFinite(v) && v > 0) n += v;
    });
    return n;
  }

  function badgeTone(key, badges, kpis) {
    var v = badges[key];
    if (v == null || v === 0) return null;
    if (key === 'awaiting_deposit') return 'red';
    if (key === 'abandoned_carts') return 'amber';
    if (key === 'orders_new') return 'blue';
    if (key === 'ready_for_collection') return 'green';
    if (key === 'price_tbc_open' || key === 'locked_orders') return 'amber';
    return 'neutral';
  }

  return {
    NAV_TREE: NAV_TREE,
    ROUTE_META: ROUTE_META,
    ICONS: ICONS,
    routeMeta: routeMeta,
    parentGroupForRoute: parentGroupForRoute,
    viewIdForRoute: viewIdForRoute,
    labelForRoute: labelForRoute,
    flattenVisibleTree: flattenVisibleTree,
    isNodeVisible: isNodeVisible,
    isLeafVisible: isLeafVisible,
    aggregateGroupBadge: aggregateGroupBadge,
    badgeTone: badgeTone
  };
});
