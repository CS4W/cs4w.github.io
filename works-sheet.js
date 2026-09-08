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

  function category(row){
    var raw=value(row,['分類','category','type']).toLowerCase();
    if(raw==='音楽ゲーム'||raw==='ゲーム'||raw==='music_game'||raw==='game')return 'music_game';
    if(raw==='楽曲提供'||raw==='commission'||raw==='provide')return 'commission';
    return raw.replace(/\s+/g,'_');
  }

  function youtubeId(url){
    var match=String(url||'').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
    return match?match[1]:'';
  }

  function spotifyEmbed(url){
    var match=String(url||'').match(/open\.spotify\.com\/(?:intl-[^/]+\/)?track\/([\w]+)/i);
    return match?'https://open.spotify.com/embed/track/'+match[1]+'?utm_source=generator&theme=0':'';
  }

  function esc(text){
    return String(text||'').replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});
  }

  function cardHtml(row,index){
    var date=value(row,['日付','date']);
    var title=value(row,['作品名','title','name']);
    var link=value(row,['リンク','url','link','youtube_url','spotify_url']);
    var image=value(row,['画像URL','image_url','thumbnail_url']);
    var collab=value(row,['コラボ名','collab','collaborator']);
    var platform=value(row,['掲載先・収録先','platform']);
    var subtitle=value(row,['補足','subtitle','note']);
    var description=value(row,['説明','description']);
    var tag=category(row);
    var ytId=youtubeId(link);
    var spotify=spotifyEmbed(link);
    var media='';

    if(ytId){
      image=image||('https://img.youtube.com/vi/'+ytId+'/mqdefault.jpg');
      media='<a href="'+esc(link)+'" target="_blank" rel="noopener" class="wcard-thumb" title="'+esc(title)+'">'+
        '<img src="'+esc(image)+'" alt="'+esc(title)+'" loading="lazy">'+
        '<div class="wcard-play"><span>▶</span></div><div class="wcard-yt-badge">YouTube ↗</div></a>';
    }else if(spotify){
      media='<div class="wcard-spotify"><iframe src="'+esc(spotify)+'" width="100%" height="80" frameborder="0" allowtransparency="true" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>';
    }else if(image){
      media='<a href="'+esc(link||'#')+'" target="_blank" rel="noopener" class="wcard-thumb" title="'+esc(title)+'"><img src="'+esc(image)+'" alt="'+esc(title)+'" loading="lazy"><div class="wcard-yt-badge">Link ↗</div></a>';
    }else{
      media='<a href="'+esc(link||'#')+'" target="_blank" rel="noopener" class="wcard-no-yt"><span class="wcard-year">'+esc(date.slice(0,4))+'</span><span class="wcard-search">↗</span></a>';
    }

    var tagHtml=tag==='music_game'?'<span class="wcard-tag tag-game">音楽ゲーム</span>':
      tag==='commission'?'<span class="wcard-tag tag-comm">楽曲提供</span>':'';
    var longClass=title.length>34?' wcard-title-long':'';
    return '<div class="wcard reveal works-sheet-item" data-tags="'+esc(tag)+'" data-work-date="'+esc(date)+'" style="--delay:'+(index%4)*70+'ms">'+
      '<div class="wcard-media">'+media+'</div><div class="wcard-info">'+
      '<span class="wcard-date">'+esc(date)+'</span><h3 class="wcard-title'+longClass+'" title="'+esc(title)+'">'+esc(title)+'</h3>'+
      (collab?'<p class="wcard-collab">'+esc(collab)+'</p>':'')+
      (platform?'<p class="wcard-plat">'+esc(platform)+'</p>':'')+
      (subtitle?'<p class="wcard-sub">'+esc(subtitle)+'</p>':'')+
      (description?'<p class="wcard-desc">'+esc(description)+'</p>':'')+
      '<div class="wcard-tags">'+tagHtml+'</div></div></div>';
  }

  function applyItems(rows){
    var grid=document.getElementById('worksGrid');
    if(!grid)return;
    var items=rows.filter(function(row){
      return value(row,['mode']).toLowerCase()==='work_item'&&enabled(row)&&value(row,['作品名','title','name']);
    });
    if(!items.length)return;

    var existing={};
    grid.querySelectorAll('.wcard').forEach(function(card){
      var title=card.querySelector('.wcard-title');
      var date=card.querySelector('.wcard-date');
      existing[(title?title.textContent.trim():'')+'|'+(date?date.textContent.trim():'')]=true;
    });
    items.forEach(function(row,index){
      var key=value(row,['作品名','title','name'])+'|'+value(row,['日付','date']);
      if(existing[key])return;
      grid.insertAdjacentHTML('beforeend',cardHtml(row,index));
      existing[key]=true;
    });

    Array.from(grid.querySelectorAll('.wcard')).sort(function(a,b){
      var ad=(a.dataset.workDate||(a.querySelector('.wcard-date')||{}).textContent||'').replace(/\D/g,'');
      var bd=(b.dataset.workDate||(b.querySelector('.wcard-date')||{}).textContent||'').replace(/\D/g,'');
      return ad.localeCompare(bd);
    }).forEach(function(card){grid.appendChild(card);});

    var cards=grid.querySelectorAll('.wcard');
    document.querySelectorAll('.ph-count em').forEach(function(el){el.textContent=cards.length;});
    var count=document.getElementById('filterCount');
    if(count)count.innerHTML='全 <em>'+cards.length+'</em> 曲';

    var observer=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}
      });
    },{threshold:0.06,rootMargin:'0px 0px -20px 0px'});
    // DOMに初期状態を一度描画してから表示クラスを付ける。
    setTimeout(function(){
      grid.querySelectorAll('.works-sheet-item').forEach(function(card){observer.observe(card);});
    },60);
  }

  function start(){
    var urls=window.CS4W_SHEET_URLS||{};
    var url=urls.works;
    if(!url)return;
    var fresh=new URL(url,location.href);
    fresh.searchParams.set('_',String(Date.now()));
    fetch(fresh.href,{cache:'no-store'}).then(function(response){
      if(!response.ok)throw new Error('Works sheet load failed');
      return response.text();
    }).then(function(text){applyItems(objects(parseCsv(text)));}).catch(function(error){
      console.warn('[works-sheet]',error.message);
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();
