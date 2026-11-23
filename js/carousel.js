export function initCarousel(carousel) {
  if (!carousel || carousel.dataset.carouselReady === "1") return;
  const viewport = carousel.querySelector(".carousel-viewport") || carousel;
  const track = carousel.querySelector(".carousel-track");
  const slides = [...carousel.querySelectorAll(".slide")];
  const prevButtons = [...carousel.querySelectorAll("[data-prev]")];
  const nextButtons = [...carousel.querySelectorAll("[data-next]")];
  const dotsWrap = carousel.querySelector("[data-carousel-dots]");
  const status = carousel.querySelector("[data-carousel-status]");
  const progress = carousel.querySelector("[data-carousel-progress]");
  const count = carousel.querySelector("[data-carousel-count]");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const autoplay = carousel.dataset.autoplay !== "off" && !reducedMotion;
  const interval = Number(carousel.dataset.interval) || 7000;
  let index = 0;
  let timer;

  if (!track || slides.length < 2) return;
  carousel.dataset.carouselReady = "1";
  viewport.style.touchAction = "pan-y";

  if (dotsWrap) {
    dotsWrap.innerHTML = slides.map((_, i) =>
      `<button class="carousel-dot" type="button" aria-label="Ir para o slide ${i + 1}"></button>`
    ).join("");
  }
  const dots = [...carousel.querySelectorAll(".carousel-dot")];

  function offset() {
    return viewport.getBoundingClientRect().width || 1;
  }

  function setPosition(extra = 0, animate = true) {
    track.style.transition = animate && !reducedMotion ? "" : "none";
    const shift = -index * 100;
    track.style.transform = extra
      ? `translate3d(calc(${shift}% + ${extra}px), 0, 0)`
      : `translate3d(${shift}%, 0, 0)`;
  }

  function restartProgress() {
    if (!progress) return;
    progress.style.animation = "none";
    void progress.offsetWidth;
    if (autoplay && !document.hidden) {
      progress.style.animation = `carouselProgress ${interval}ms linear`;
    }
  }

  function show(nextIndex, announce = true) {
    index = (nextIndex + slides.length) % slides.length;
    setPosition(0, true);
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.setAttribute("aria-hidden", String(!active));
      slide.querySelectorAll("a,button").forEach((el) => { el.tabIndex = active ? 0 : -1; });
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
      dot.setAttribute("aria-current", i === index ? "true" : "false");
    });
    if (count) count.textContent = `${index + 1} / ${slides.length}`;
    if (announce && status) status.textContent = `Slide ${index + 1} de ${slides.length}`;
    restartProgress();
  }

  function start() {
    clearInterval(timer);
    if (!autoplay || document.hidden) return;
    timer = setInterval(() => show(index + 1, false), interval);
    restartProgress();
  }

  function restart() {
    clearInterval(timer);
    start();
  }

  prevButtons.forEach((button) => button.addEventListener("click", () => { show(index - 1); restart(); }));
  nextButtons.forEach((button) => button.addEventListener("click", () => { show(index + 1); restart(); }));
  dots.forEach((dot, i) => dot.addEventListener("click", () => { show(i); restart(); }));

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let axis = null;

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    carousel.classList.remove("is-dragging");
    const dx = lastX - startX;
    const threshold = Math.min(48, offset() * 0.16);
    if (axis === "x" && Math.abs(dx) > threshold) {
      show(index + (dx < 0 ? 1 : -1));
    } else {
      show(index, false);
    }
    axis = null;
    restart();
  }

  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest("button")) return;
    dragging = true;
    axis = null;
    startX = lastX = event.clientX;
    startY = event.clientY;
    clearInterval(timer);
    if (progress) progress.style.animationPlayState = "paused";
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis === "x") {
        carousel.classList.add("is-dragging");
        track.style.transition = "none";
        viewport.setPointerCapture?.(event.pointerId);
      } else {
        dragging = false;
        restart();
      }
    }
    if (axis !== "x") return;
    lastX = event.clientX;
    setPosition(dx, false);
  });

  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("lostpointercapture", endDrag);

  carousel.addEventListener("mouseenter", () => {
    if (matchMedia("(hover: hover)").matches) {
      clearInterval(timer);
      if (progress) progress.style.animationPlayState = "paused";
    }
  });
  carousel.addEventListener("mouseleave", start);
  carousel.addEventListener("focusin", () => {
    clearInterval(timer);
    if (progress) progress.style.animationPlayState = "paused";
  });
  carousel.addEventListener("focusout", (event) => {
    if (!carousel.contains(event.relatedTarget)) start();
  });
  document.addEventListener("visibilitychange", () => document.hidden ? clearInterval(timer) : start());
  addEventListener("resize", () => show(index, false));

  show(0, false);
  start();
}

document.querySelectorAll("[data-carousel]").forEach(initCarousel);
