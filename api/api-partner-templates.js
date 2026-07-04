// api/partner-templates.js
// GET  /api/partner-templates?partner_id=<id>  -> {templates}
// POST /api/partner-templates  body:{action:'save'|'apply'|'delete', ...}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  res.setHeader('content-type','application/json');
  try {
    if (req.method==='GET') {
      const pid=((req.query&&req.query.partner_id)||'').trim();
      if(!pid)return res.status(400).json({ok:false,error:'partner_id required'});
      const {data,error}=await sb.from('partner_templates').select('*')
        .eq('partner_id',pid).order('is_default',{ascending:false}).order('created_at',{ascending:false});
      if(error)return res.status(500).json({ok:false,error:error.message});
      return res.status(200).json({ok:true,templates:data||[]});
    }
    if (req.method==='POST') {
      let b={};
      try{b=(typeof req.body==='object'&&req.body)?req.body:JSON.parse(req.body||'{}');}
      catch(_){return res.status(400).json({ok:false,error:'Invalid JSON'});}
      const {action,partner_id,name,description,apps,is_default,template_id,site_id}=b;

      if (action==='save') {
        if(!partner_id||!name||!apps)
          return res.status(400).json({ok:false,error:'partner_id, name, apps required'});
        // if setting as default, unset others
        if(is_default){
          await sb.from('partner_templates').update({is_default:false}).eq('partner_id',partner_id);
        }
        const row={partner_id,name,description:description||null,apps,is_default:!!is_default,updated_at:new Date().toISOString()};
        const {error}=template_id
          ? await sb.from('partner_templates').update(row).eq('id',template_id)
          : await sb.from('partner_templates').insert(row);
        if(error)return res.status(500).json({ok:false,error:error.message});
        return res.status(200).json({ok:true});
      }

      if (action==='apply') {
        // apply template to a site: upsert each app in the template to site_apps
        if(!template_id||!site_id)
          return res.status(400).json({ok:false,error:'template_id, site_id required'});
        const {data:tmpl,error:te}=await sb.from('partner_templates').select('apps').eq('id',template_id).maybeSingle();
        if(te||!tmpl)return res.status(404).json({ok:false,error:'Template not found'});
        const rows=(tmpl.apps||[]).map(function(a){
          return {site_id,app_id:a.app_id,enabled:true,
            position_slot:a.slot||'mid',position_order:a.order||0,
            config:a.config_defaults||{}};
        });
        if(rows.length){
          const {error:ue}=await sb.from('site_apps').upsert(rows,{onConflict:'site_id,app_id'});
          if(ue)return res.status(500).json({ok:false,error:ue.message});
        }
        return res.status(200).json({ok:true,applied:rows.length});
      }

      if (action==='delete') {
        if(!template_id)return res.status(400).json({ok:false,error:'template_id required'});
        const {error}=await sb.from('partner_templates').delete().eq('id',template_id);
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
