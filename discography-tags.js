(function(){
  'use strict';

  function parseCsv(text){
    var rows=[],row=[],cell='',quoted=false;
    for(var i=0;i<text.length;i++){
      var ch=text[i],next=text[i+1];
      if(quoted){
        if(ch==='"'&&next==='"'){cell+='"';i++;}
        else if(ch==='"'){quoted=false;}
        else{cell+=ch;}
      }else if(ch==='"'){quoted=true;}
      else if(ch===','){row.push(cell);cell='';}
      else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
      else{cell+=ch;}
    }
    if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
    return rows;
  }

  function objects(rows){
    if(!rows.length)return [];
    var headers=rows[0].map(function(value){return String(value||'').trim();});
    return rows.slice(1).map(function(row){
      var item={};
      headers.forEach(function(header,index){item[header]=row[index]==null?'':row[index];});
      return item;
    });
  }

  function value(row,names){
    for(var i=0;i<names.length;i++){
      var found=row[names[i]];
      if(found!=null&&String(found).trim()!=='')return String(found).trim();
    }
    return '';
  }

  function enabled(row){
    var flag=value(row,['表示','enabled','value']).toLowerCase();
    return !/^(false|0|off|no|非表示)$/.test(flag);
  }

  function splitTags(raw){
    var seen={};
    return String(raw||'').split(/[,，、;；|]/).map(function(tag){return tag.trim();}).filter(function(tag){
      var key=tag.toLowerCase();
      if(!key||seen[key])return false;
      seen[key]=true;
      return true;
    });
  }

  function applyTags(rows){
    var tracks=Array.isArray(window.CS4W_TRACKS)?window.CS4W_TRACKS:[];
    var byId={},byName={};
    tracks.forEach(function(track){
      byId[String(track.ytId||'').toLowerCase()]=track;
      byName[String(track.name||'').trim().toLowerCase()]=track;
    });
    rows.forEach(function(row){
      if(value(row,['mode']).toLowerCase()!=='track_tags'||!enabled(row))return;
      var id=value(row,['曲ID（YouTube ID）','YouTube ID','ytId','track_id']).toLowerCase();
      var name=value(row,['曲名','作品名','title','name']).toLowerCase();
      var track=byId[id]||byName[name];
      if(track)track.tags=splitTags(value(row,['タグ（カンマ区切り）','タグ','tags','tag']));
    });
    return tracks;
  }

  function start(){
    var url=(window.CS4W_SHEET_URLS||{}).discography;
    if(!url)return Promise.resolve([]);
    var fresh=new URL(url,location.href);
    fresh.searchParams.set('_',String(Date.now()));
    return fetch(fresh.href,{cache:'no-store'}).then(function(response){
      if(!response.ok)throw new Error('Discography tags sheet load failed');
      return response.text();
    }).then(function(text){return applyTags(objects(parseCsv(text)));}).catch(function(error){
      console.warn('[discography-tags]',error.message);
      return [];
    });
  }

  window.CS4W_DISCOGRAPHY_TAGS_PROMISE=start();
})();
