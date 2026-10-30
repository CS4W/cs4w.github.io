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

  function splitValues(raw){
    var seen={};
    return String(raw||'').split(/[,，、;；|]/).map(function(tag){return tag.trim();}).filter(function(tag){
      var key=tag.toLowerCase();
      if(!key||seen[key])return false;
      seen[key]=true;
      return true;
    });
  }

  function splitDestinations(raw){
    var seen={};
    return String(raw||'').split(/[,，、;；|／/]/).map(function(item){return item.trim();}).filter(function(item){
      var key=item.toLowerCase();
      if(!key||seen[key])return false;
      seen[key]=true;
      return true;
    });
  }

  function youtubeId(raw){
    var text=String(raw||'').trim();
    var match=text.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{6,})/i);
    return match?match[1].toLowerCase():'';
  }

  function keyFor(label){
    return String(label||'').trim().toLowerCase().replace(/\s+/g,'-');
  }

  function fallbackLabels(track,field){
    var genreLabels={
      'gothic-hardcore':'Gothic Hardcore','artcore':'Artcore','bass-house':'Bass House',
      'dubstep':'Dubstep','midtempo':'Midtempo','gothic':'Gothic','frenchcore':'Frenchcore',
      'piano':'Piano','ambient':'Ambient','gothic-hitech':'Gothic Hi-Tech'
    };
    var gameLabels={
      'dynamix':'Dynamix','takumi3':'TAKUMI³','orzmic':'Orzmic','lanota':'Lanota',
      'osu':'osu!','musynx':'MUSYNX','dancerai13':'DanceRail3','berry-melody':'Berry Melody'
    };
    var labels=field==='genre'?genreLabels:gameLabels;
    return String(track[field]||'').split(/[|,]/).map(function(item){
      var key=item.trim().toLowerCase();
      return labels[key]||item.trim();
    }).filter(Boolean);
  }

  function setClassification(track,field,labels){
    track[field+'Labels']=labels;
    track[field]=labels.map(keyFor).join('|');
  }

  function prepareTracks(){
    var tracks=Array.isArray(window.CS4W_TRACKS)?window.CS4W_TRACKS:[];
    tracks.forEach(function(track){
      setClassification(track,'genre',fallbackLabels(track,'genre'));
      setClassification(track,'game',fallbackLabels(track,'game'));
    });
    return tracks;
  }

  function applyClassifications(rows){
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
      if(track){
        setClassification(track,'genre',splitValues(value(row,['ジャンル（複数はカンマ区切り）','ジャンル','genre'])));
        setClassification(track,'game',splitValues(value(row,['ゲーム（複数はカンマ区切り）','ゲーム','game'])));
      }
    });
    return tracks;
  }

  function applyWorksGames(rows){
    var tracks=Array.isArray(window.CS4W_TRACKS)?window.CS4W_TRACKS:[];
    var byId={},byName={};
    tracks.forEach(function(track){
      byId[String(track.ytId||'').toLowerCase()]=track;
      byName[String(track.name||'').trim().toLowerCase()]=track;
    });
    rows.forEach(function(row){
      if(value(row,['mode']).toLowerCase()!=='work_item'||!enabled(row))return;
      if(value(row,['分類','category','type']).toLowerCase()!=='music_game')return;
      var id=youtubeId(value(row,['リンク','URL','url','link']));
      var name=value(row,['作品名','曲名','title','name']).toLowerCase();
      var track=byId[id]||byName[name];
      var games=splitDestinations(value(row,['掲載先・収録先','収録先','ゲーム','game']));
      if(track&&games.length)setClassification(track,'game',games);
    });
    return tracks;
  }

  function loadRows(url,label){
    if(!url)return Promise.resolve([]);
    var fresh=new URL(url,location.href);
    fresh.searchParams.set('_',String(Date.now()));
    return fetch(fresh.href,{cache:'no-store'}).then(function(response){
      if(!response.ok)throw new Error(label+' sheet load failed');
      return response.text();
    }).then(function(text){return objects(parseCsv(text));}).catch(function(error){
      console.warn('[discography-classifications]',error.message);
      return [];
    });
  }

  function start(){
    var urls=window.CS4W_SHEET_URLS||{};
    prepareTracks();
    return Promise.all([
      loadRows(urls.discography,'Discography classification'),
      loadRows(urls.works,'Works')
    ]).then(function(results){
      applyClassifications(results[0]);
      return applyWorksGames(results[1]);
    });
  }

  window.CS4W_DISCOGRAPHY_TAGS_PROMISE=start();
})();
