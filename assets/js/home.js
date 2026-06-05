// assets/js/home.js — The Blue & White homepage
// Fills the magazine front page from PUBLISHED articles in Supabase.
// Requires the supabase-js script to be loaded before this file.

(function () {
  'use strict';

  var SUPABASE_URL = 'https://cybjclqcdmrjhoaoiund.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_G-U4_7cECYwC3c1Sa2MqWQ_9NHN-7_g';

  var LABEL_CLASS = {
    'News':'label-news','Sports':'label-sports','Culture':'label-culture',
    'Hot Spot':'label-hotspot','We Are Wharton':'label-wharton','Editorial':'label-editorial'
  };

  function esc(v){return (v==null?'':String(v)).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function fmtDate(iso){if(!iso)return '';var d=new Date(iso);return isNaN(d.getTime())?'':d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});}
  function url(a){var p=(a.github_path||'').replace(/^\/+/,'');return p?'/'+p:'#';}
  function label(s){return LABEL_CLASS[s]||'label-news';}
  function byline(a,withDate){var parts=['By <strong>'+esc(a.author_name||'Staff')+'</strong>'];if(withDate&&a.published_at)parts.push(esc(fmtDate(a.published_at)));return parts.join(' &nbsp;&middot;&nbsp; ');}
  function setHTML(id,html){var el=document.getElementById(id);if(el)el.innerHTML=html;}
  function bgStyle(photoUrl){return photoUrl?'style="background-image:url(\''+photoUrl.replace(/'/g,'%27')+'\');background-size:cover;background-position:center;"':'';}

  function slideHTML(a){
    return '<div class="carousel-slide">'+
      '<a href="'+url(a)+'">'+
        '<div class="slide-img" '+bgStyle(a.photo_url)+'><div class="slide-badge">'+esc(a.section||'Top Story')+'</div></div>'+
        '<span class="section-label '+label(a.section)+'">'+esc(a.section||'')+'</span>'+
        '<div class="headline-main">'+esc(a.headline||'Untitled')+'</div>'+
      '</a>'+
      '<p class="byline">'+byline(a,true)+'</p>'+
      (a.dek?'<p class="deck">'+esc(a.dek)+'</p>':'')+
    '</div>';
  }
  function heroMainHTML(a){
    if(!a)return '<p class="deck" style="color:var(--text-muted);">Top stories will appear here as they publish.</p>';
    return '<span class="section-label '+label(a.section)+'">'+esc(a.section||'')+'</span>'+
      '<div class="thumb" '+bgStyle(a.photo_url)+'></div>'+
      '<a href="'+url(a)+'"><h2 class="headline-sub">'+esc(a.headline||'Untitled')+'</h2></a>'+
      '<p class="byline">'+byline(a,false)+'</p>'+
      (a.dek?'<p class="deck">'+esc(a.dek)+'</p>':'');
  }
  function heroSideHTML(a){
    if(!a)return '';
    return '<span class="section-label '+label(a.section)+'">'+esc(a.section||'')+'</span>'+
      '<a href="'+url(a)+'"><h2 class="headline-sub">'+esc(a.headline||'Untitled')+'</h2></a>'+
      '<p class="byline">'+byline(a,false)+'</p>'+
      (a.dek?'<p class="deck" style="font-size:13px;">'+esc(a.dek)+'</p>':'');
  }
  function colCardHTML(a){
    return '<div class="article-card">'+
      (a.photo_url?'<div class="thumb-sm" '+bgStyle(a.photo_url)+'></div>':'')+
      '<span class="section-label '+label(a.section)+'">'+esc(a.section||'')+'</span>'+
      '<a href="'+url(a)+'"><h3 class="headline-sm">'+esc(a.headline||'Untitled')+'</h3></a>'+
      (a.dek?'<p class="deck" style="font-size:12px;">'+esc(a.dek)+'</p>':'')+
    '</div>';
  }
  function colEmptyHTML(section){return '<div class="article-card"><p class="deck" style="color:var(--text-muted);font-size:12px;">More '+esc(section)+' stories coming soon.</p></div>';}
  function featureHTML(a,section){
    if(!a)return '<div class="feature-card" style="opacity:0.5;cursor:default;"><span class="feature-label">'+esc(section)+'</span><div class="feature-headline" style="font-size:15px;">More '+esc(section)+' coming soon</div></div>';
    return '<a href="'+url(a)+'" class="feature-card">'+
      '<span class="feature-label">'+esc(a.section||section)+'</span>'+
      '<div class="feature-headline">'+esc(a.headline||'Untitled')+'</div>'+
      (a.dek?'<div class="feature-deck">'+esc(a.dek)+'</div>':'')+
    '</a>';
  }

  var story={idx:0,total:0,timer:null};
  function applyStory(){var track=document.getElementById('storyTrack');var dots=document.getElementById('storyDots');if(!track)return;track.style.transform='translateX(-'+(story.idx*100)+'%)';if(dots)dots.querySelectorAll('.dot').forEach(function(d,i){d.classList.toggle('active',i===story.idx);});}
  function autoplay(){clearInterval(story.timer);if(story.total>1){story.timer=setInterval(function(){story.idx=(story.idx+1)%story.total;applyStory();},6000);}}
  window.BWHome={
    moveStory:function(dir){if(!story.total)return;story.idx=(story.idx+dir+story.total)%story.total;applyStory();autoplay();},
    goStory:function(i){story.idx=i;applyStory();autoplay();}
  };
  function buildCarousel(items){
    var track=document.getElementById('storyTrack');var dots=document.getElementById('storyDots');if(!track)return;
    if(!items.length){track.innerHTML='<div class="carousel-slide"><div class="headline-main" style="color:var(--text-muted);">No stories published yet.</div></div>';if(dots)dots.innerHTML='';story.total=0;return;}
    track.innerHTML=items.map(slideHTML).join('');
    if(dots)dots.innerHTML=items.map(function(a,i){return '<button class="dot'+(i===0?' active':'')+'" onclick="BWHome.goStory('+i+')" aria-label="Story '+(i+1)+'"></button>';}).join('');
    story.idx=0;story.total=items.length;applyStory();autoplay();
  }

  async function populate(){
    if(!window.supabase||!window.supabase.createClient)return;
    var res;
    try{
      var sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
      res=await sb.from('articles')
        .select('headline,dek,section,author_name,published_at,github_path,photo_url')
        .eq('status','published')
        .order('published_at',{ascending:false})
        .limit(60);
    }catch(e){console.error('[home]',e);return;}
    if(res.error){console.error('[home]',res.error);return;}

    var all=(res.data||[]).filter(function(a){return a.github_path;});
    function bySection(s){return all.filter(function(a){return a.section===s;});}

    buildCarousel(all.slice(0,5));
    setHTML('heroMain',heroMainHTML(all[0]));
    setHTML('heroSecondary',heroSideHTML(all[1]));
    setHTML('heroTertiary',heroSideHTML(all[2]));

    [['colCulture','Culture'],['colHotspot','Hot Spot'],['colWharton','We Are Wharton']].forEach(function(pair){
      var items=bySection(pair[1]).slice(0,2);
      setHTML(pair[0],items.length?items.map(colCardHTML).join(''):colEmptyHTML(pair[1]));
    });

    var fs=document.getElementById('featureStrip');
    if(fs){fs.innerHTML=['Editorial','Sports','Hot Spot'].map(function(s){return featureHTML(bySection(s)[0],s);}).join('');}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',populate);
  else populate();
})();
