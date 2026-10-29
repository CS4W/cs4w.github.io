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
    var headers=rows[0].map(function(v){return String(v||'').trim();});
    return rows.slice(1).map(function(row){
      var item={};
      headers.forEach(function(header,index){item[header]=row[index]==null?'':row[index];});
      return item;
    });
  }

  function value(row,names){
    for(var i=0;i<names.length;i++){
      var v=row[names[i]];
      if(v!=null&&String(v).trim()!=='')return String(v).trim();
    }
    return '';
  }

  function enabled(row){
    var flag=value(row,['表示','enabled','value']).toLowerCase();
    return !/^(false|0|off|no|非表示)$/.test(flag);
  }

  function appendGames(rows){
    var list=document.getElementById('gamesList');
    if(!list)return;
    var existing={};
    list.querySelectorAll('.game-name').forEach(function(el){existing[el.textContent.trim().toLowerCase()]=true;});
    rows.filter(function(row){
      return value(row,['mode']).toLowerCase()==='game_title'&&enabled(row)&&value(row,['ゲームタイトル','タイトル','game_title','title']);
    }).forEach(function(row){
      var title=value(row,['ゲームタイトル','タイトル','game_title','title']);
      var note=value(row,['補足','note']);
      var key=title.toLowerCase();
      if(existing[key])return;
      var item=document.createElement('li');
      item.className='game-item game-sheet-item';
      var name=document.createElement('span');
      name.className='game-name';
      name.textContent=title;
      item.appendChild(name);
      if(note){
        var sub=document.createElement('span');
        sub.className='game-note';
        sub.textContent=note;
        item.appendChild(sub);
      }
      list.appendChild(item);
      existing[key]=true;
    });
  }

  function start(){
    var url=(window.CS4W_SHEET_URLS||{}).about;
    if(!url)return;
    var fresh=new URL(url,location.href);
    fresh.searchParams.set('_',String(Date.now()));
    fetch(fresh.href,{cache:'no-store'}).then(function(response){
      if(!response.ok)throw new Error('About games sheet load failed');
      return response.text();
    }).then(function(text){appendGames(objects(parseCsv(text)));}).catch(function(error){
      console.warn('[about-games]',error.message);
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();
