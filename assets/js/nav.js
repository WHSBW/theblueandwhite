// Highlight active nav item based on current page
document.addEventListener('DOMContentLoaded', function() {
  const path = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-inner a');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && path.includes(href) && href !== '/') {
      link.classList.add('active');
    }
  });

  // Homepage carousel logic
  const carousels = {
    story: { idx: 0, total: 0 },
    brief: { idx: 0, total: 0 }
  };

  function initCarousel(id) {
    const track = document.getElementById(id + 'Track');
    const dots = document.getElementById(id + 'Dots');
    if (!track || !dots) return;
    carousels[id].total = track.children.length;
    carousels[id].idx = 0;
  }

  window.moveCarousel = function(id, dir) {
    const c = carousels[id];
    if (!c.total) return;
    c.idx = (c.idx + dir + c.total) % c.total;
    applyCarousel(id);
  };

  window.goToSlide = function(id, i) {
    carousels[id].idx = i;
    applyCarousel(id);
  };

  function applyCarousel(id) {
    const c = carousels[id];
    const track = document.getElementById(id + 'Track');
    const dots = document.getElementById(id + 'Dots');
    if (!track || !dots) return;
    track.style.transform = 'translateX(-' + (c.idx * 100) + '%)';
    dots.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('active', i === c.idx);
    });
  }

  initCarousel('story');
  initCarousel('brief');
});
