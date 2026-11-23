const counters = document.querySelectorAll("[data-count]");

function animateCounter(element) {
  const target = Number(element.dataset.count);
  const suffix = element.dataset.suffix || "";
  const duration = 1200;
  const start = performance.now();
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = `${Math.round(target * eased)}${suffix}`;
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      observer.unobserve(entry.target);
    }
  }), { threshold: .6 });
  counters.forEach(counter => observer.observe(counter));
} else {
  counters.forEach(animateCounter);
}
