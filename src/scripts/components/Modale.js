import { ScrollSmoother } from 'gsap/ScrollSmoother.js';

export default class Modale {
  constructor(element) {
    this.element = element;
    this.openButtons = document.querySelectorAll('[data-modale-open]');
    this.closeButton = this.element.querySelector('[data-modale-close]');
    this.lastFocused = null;

    this.onKeyDown = this.onKeyDown.bind(this);

    this.init();
  }

  init() {
    // ScrollSmoother applique un transform sur #smooth-content : un élément en position: fixed
    // placé à l'intérieur ne serait plus centré sur l'écran. On sort donc la modale du wrapper.
    document.body.appendChild(this.element);

    for (let i = 0; i < this.openButtons.length; i++) {
      this.openButtons[i].addEventListener('click', this.open.bind(this));
    }

    this.closeButton.addEventListener('click', this.close.bind(this));

    // Un clic sur le fond flouté (en dehors de la boîte) ferme la modale
    this.element.addEventListener('click', (event) => {
      if (event.target === this.element) this.close();
    });
  }

  open() {
    this.lastFocused = document.activeElement;
    this.element.classList.add('is-open');
    this.element.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', this.onKeyDown);

    // Bloque le défilement de la page derrière la modale
    const smoother = ScrollSmoother.get();
    if (smoother) smoother.paused(true);

    this.closeButton.focus();
  }

  close() {
    this.element.classList.remove('is-open');
    this.element.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', this.onKeyDown);

    const smoother = ScrollSmoother.get();
    if (smoother) smoother.paused(false);

    // Redonne le focus au bouton qui a ouvert la modale
    if (this.lastFocused) this.lastFocused.focus();
  }

  onKeyDown(event) {
    if (event.key === 'Escape') this.close();
  }
}
