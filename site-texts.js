(function(){
  'use strict';

  /*
    Googleスプレッドシート連動用。
    公開CSVのURLをここに貼ると、サイト表示時に文章が自動で差し替わります。

    例:
    var SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/xxxxxxxx/pub?output=csv';

    ページごとにシートを分ける場合は、下の SHEET_CSV_URLS にページ別CSV URLを貼ってください。
  */
  var SHEET_CSV_URL = '';
  var SHEET_CSV_URLS = {
    home: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR0vsq56OBCKUC-Xjpc32-SBASQVBh2FzqEAAJ-z5WtqN6C-O0qW_WbseEz6iSqBkSPhavNN8c_zxJp/pub?gid=411836191&single=true&output=csv',
    works: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR0vsq56OBCKUC-Xjpc32-SBASQVBh2FzqEAAJ-z5WtqN6C-O0qW_WbseEz6iSqBkSPhavNN8c_zxJp/pub?gid=277012435&single=true&output=csv',
    discography: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR0vsq56OBCKUC-Xjpc32-SBASQVBh2FzqEAAJ-z5WtqN6C-O0qW_WbseEz6iSqBkSPhavNN8c_zxJp/pub?gid=721218047&single=true&output=csv',
    about: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR0vsq56OBCKUC-Xjpc32-SBASQVBh2FzqEAAJ-z5WtqN6C-O0qW_WbseEz6iSqBkSPhavNN8c_zxJp/pub?gid=955376999&single=true&output=csv',
    contact: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR0vsq56OBCKUC-Xjpc32-SBASQVBh2FzqEAAJ-z5WtqN6C-O0qW_WbseEz6iSqBkSPhavNN8c_zxJp/pub?gid=1060767638&single=true&output=csv'
  };
  var AUTO_REFRESH_MS = 30000;
  var FALLBACK_CSV = rootUrl('site-texts.csv');

  function rootUrl(file){
    var scripts = document.getElementsByTagName('script');
    var current = scripts[scripts.length - 1];
    var src = current && current.src ? current.src : '';
    return src ? new URL(file, src).href : file;
  }

  function currentPage(){
    var page = document.body && document.body.getAttribute('data-page');
    if(page) return page;
    var path = location.pathname.replace(/\\/g, '/');
    if(/\/works\/index\.html$|\/works\/?$/.test(path)) return 'works';
    if(/\/discography\/index\.html$|\/discography\/?$/.test(path)) return 'discography';
    if(/\/about\/index\.html$|\/about\/?$/.test(path)) return 'about';
    if(/\/contact\/index\.html$|\/contact\/?$/.test(path)) return 'contact';
    return 'home';
  }

  function parseCsv(text){
    var rows = [];
    var row = [];
    var cell = '';
    var quote = false;

    for(var i = 0; i < text.length; i++){
      var ch = text[i];
      var next = text[i + 1];

      if(quote){
        if(ch === '"' && next === '"'){
          cell += '"';
          i++;
        }else if(ch === '"'){
          quote = false;
        }else{
          cell += ch;
        }
      }else{
        if(ch === '"'){
          quote = true;
        }else if(ch === ','){
          row.push(cell);
          cell = '';
        }else if(ch === '\n'){
          row.push(cell.replace(/\r$/, ''));
          rows.push(row);
          row = [];
          cell = '';
        }else{
          cell += ch;
        }
      }
    }

    if(cell || row.length){
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
    }
    return rows;
  }

  function toObjects(rows){
    if(!rows.length) return [];
    var header = rows[0].map(function(v){ return String(v || '').trim(); });
    return rows.slice(1).map(function(row){
      var obj = {};
      header.forEach(function(key, i){ obj[key] = row[i] == null ? '' : row[i]; });
      return obj;
    }).filter(function(obj){
      return obj.selector && obj.mode;
    });
  }

  function pageMatches(rowPage, page){
    rowPage = String(rowPage || '*').trim();
    return !rowPage || rowPage === '*' || rowPage === page;
  }

  function applyRow(row, page){
    if(!pageMatches(row.page, page)) return;

    var nodes;
    try{
      nodes = document.querySelectorAll(row.selector);
    }catch(e){
      console.warn('[site-texts] selector error:', row.selector);
      return;
    }

    nodes.forEach(function(node){
      var mode = String(row.mode || 'text').trim();
      var value = row.value == null ? '' : row.value;

      if(mode === 'text'){
        node.textContent = value;
      }else if(mode === 'html'){
        node.innerHTML = value;
      }else if(mode.indexOf('attr:') === 0){
        node.setAttribute(mode.slice(5), value);
      }
    });
  }

  function noCacheUrl(url){
    try{
      var u = new URL(url, location.href);
      u.searchParams.set('_', String(Date.now()));
      return u.href;
    }catch(e){
      return url + (url.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
    }
  }

  function loadTexts(){
    var page = currentPage();
    var url = SHEET_CSV_URLS[page] || SHEET_CSV_URL || FALLBACK_CSV;
    fetch(noCacheUrl(url), { cache: 'no-store' })
      .then(function(res){
        if(res.ok) return res;
        return fetch(url, { cache: 'reload' });
      })
      .then(function(res){
        if(!res.ok) throw new Error('CSV load failed');
        return res.text();
      })
      .then(function(text){
        toObjects(parseCsv(text)).forEach(function(row){ applyRow(row, page); });
        document.documentElement.setAttribute('data-sheet-texts', 'loaded');
      })
      .catch(function(err){
        console.warn('[site-texts]', err.message);
      });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', loadTexts);
  }else{
    loadTexts();
  }

  if(AUTO_REFRESH_MS > 0){
    setInterval(loadTexts, AUTO_REFRESH_MS);
  }
})();
