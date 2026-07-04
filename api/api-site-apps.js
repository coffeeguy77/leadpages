// api/site-apps.js
// GET  /api/site-apps?site_id=<id>   -> {apps:[...with subscription status]}
// POST /api/site-apps                -> enable/update/disable an app on a site
//   body: {site_id, app_id, action:'enable'|'disable'|'update', config?, position_slot?, position_order?}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  res.setHeader('content-type','application/json');
  try {
    if (req.method==='GET') {
      const site_id = ((req.query&&req.query.site_id)||'').trim();
      if (!site_id) return res.status(400).json({ok:false,error:'site_id required'});
      // get enabled apps + subscription status in one query
      const {data,error} = await sb.from('site_apps')
        .select(`id,app_id,enabled,position_slot,position_order,config,placed_at,
          app_registry(slug,section_key,name,tier,default_position,can_reposition,hero_exclusive),
          site_app_subscriptions(status,billing_cycle,current_period_end,access_until)`)
        .eq('site_id',site_id)
        .order('position_order',{ascending:true});
      if (error) return res.status(500).json({ok:false,error:error.message});
      // annotate each app with its activation state
      const annotated=(data||[]).map(function(row){
        const sub=(row.site_app_subscriptions&&row.site_app_subscriptions[0])||null;
        const tier=row.app_registry&&row.app_registry.tier;
        let state='inactive'; // not subscribed / not enabled
        if(!row.enabled) state='disabled';
        else if(tier==='default'||tier==='free') state='active';
        else if(sub&&sub.status==='active') state='active';
        else if(sub&&sub.status==='grace') state='grace';
        else if(sub&&(sub.status==='suspended'||sub.status==='cancelled')) state='inactive';
        else state='ghost'; // placed but no subscription
        return Object.assign({},row,{activation_state:state});
      });
      return res.status(200).json({ok:true,apps:annotated});
    }

    if (req.method==='POST') {
      let b={};
      try{b=(typeof req.body==='object'&&req.body)?req.body:JSON.parse(req.body||'{}');}
      catch(_){return res.status(400).json({ok:false,error:'Invalid JSON'});}
      const {site_id,app_id,action,config,position_slot,position_order}=b;
      if (!site_id||!app_id||!action)
        return res.status(400).json({ok:false,error:'site_id, app_id, action required'});
      if (action==='enable') {
        const {error}=await sb.from('site_apps').upsert(
          {site_id,app_id,enabled:true,
           position_slot:position_slot||'mid',
           position_order:position_order||0,
           config:config||{}},
          {onConflict:'site_id,app_id'});
        if(error)return res.status(500).json({ok:false,error:error.message});
        return res.status(200).json({ok:true});
      }
      if (action==='disable') {
        const {error}=await sb.from('site_apps').update({enabled:false})
          .eq('site_id',site_id).eq('app_id',app_id);
        if(error)return res.status(500).json({ok:false,error:error.message});
        return res.status(200).json({ok:true});
      }
      if (action==='update') {
        const upd={};
        if(config!==undefined)upd.config=config;
        if(position_slot!==undefined)upd.position_slot=position_slot;
        if(position_order!==undefined)upd.position_order=position_order;
        const {error}=await sb.from('site_apps').update(upd)
          .eq('site_id',site_id).eq('app_id',app_id);
        if(error)return res.status(500).json({ok:false,error:error.message});
        return res.status(200).json({ok:true});
      }
      return res.status(400).json({ok:false,error:'Unknown action'});
    }
    return res.status(405).json({ok:false,error:'Method not allowed'});
  } catch(e){
    return res.status(500).json({ok:false,error:String(e&&e.message||e)});
  }
};
