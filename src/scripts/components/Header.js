export default class Header {
  constructor(element) {
    this.element = element;
    this.options = {
      threshold: 0.1,
    };

    this.header = document.querySelector(".header");
    this.scrollPosition = 0;
    this.lastScrollPosition = 0;
    this.html = document.documentElement;

    // Le header est sorti de #smooth-content (déplacé par ScrollSmoother avec un transform) :
    // sinon position: sticky/fixed ne fonctionne pas et le header défile avec le contenu.
    document.body.appendChild(this.header);

    this.init();
    this.initNavMobile();
  }

  init() {
    this.setOptions();
    window.addEventListener("scroll", this.onScroll.bind(this), { passive: true });
  }

  initNavMobile() {
    const toggle = this.element.querySelector(".js-toggle");
    toggle.addEventListener("click", this.onToggleNav.bind(this));
  }

  setOptions() {
    if ("threshold" in this.header.dataset) {
      this.options.threshold = this.header.dataset.threshold;
    }
    if ("alwaysShow" in this.header.dataset) {
      this.options.threshold = 1000;
    }
  }

  onToggleNav() {
    this.html.classList.toggle("nav-is-active");
  }

  onScroll() {
    this.lastScrollPosition = this.scrollPosition;
    this.scrollPosition = document.scrollingElement.scrollTop;

    this.setHeaderState();
    this.setDirections();
  }

  setDirections() {
    if (this.scrollPosition >= this.lastScrollPosition) {
      this.html.classList.add("is-scrolling-down");
      this.html.classList.remove("is-scrolling-up");
    } else {
      this.html.classList.add("is-scrolling-up");
      this.html.classList.remove("is-scrolling-down");
    }
  }

  // Caché : on a dépassé le seuil ET on descend.
  // Visible : dès qu'on remonte, peu importe où on est sur la page, ou quand on est sous le seuil.
  setHeaderState() {
    const limit =
      document.scrollingElement.scrollHeight * this.options.threshold;

    if (this.scrollPosition < limit) {
      this.html.classList.remove("header-is-hidden");
    } else if (this.scrollPosition > this.lastScrollPosition) {
      this.html.classList.add("header-is-hidden");
    } else if (this.scrollPosition < this.lastScrollPosition) {
      this.html.classList.remove("header-is-hidden");
    }
  }
}
