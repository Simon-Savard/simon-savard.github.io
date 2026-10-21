import { gsap } from 'gsap';

// Animation d'apparition de tous les textes du site, déclenchée quand le texte entre à l'écran.
// Équivalent de : gsap.from(".text", { opacity: 0, y: 30, duration: 1, ease: "power2.out" })
// mais lancée individuellement pour chaque texte, au moment où il devient visible.
//
// Utilisation : new TextReveal();   (toute la page, voir Main.js)
//
// Pour exclure un texte (ou toute une zone) : ajouter l'attribut data-no-reveal sur l'élément ou son parent.
//   ex. : <header data-no-reveal> ... </header>

const DEFAULTS = {
  // Éléments considérés comme des « textes »
  selector: 'h1, h2, h3, h4, h5, h6, p, li, .btn, .btn_secondary',
  // Zones ignorées : le texte des cartes a déjà sa propre animation au survol (cards.scss)
  exclude: '.card_content, [data-component="TextAnim"], [data-no-reveal]',
  opacity: 0,
  y: 30,
  duration: 1,
  ease: 'power2.out',
};

export default class TextReveal {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.targets = [];
    this.observer = null;

    // Pas d'animation si l'utilisateur demande moins de mouvement : les textes restent simplement visibles
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !('IntersectionObserver' in window)) return;

    this.init();
  }

  init() {
    this.targets = this.getTargets();

    // État de départ : le texte est caché, 30px plus bas
    gsap.set(this.targets, { opacity: this.options.opacity, y: this.options.y });

    this.observer = new IntersectionObserver(this.watch.bind(this));
    for (let i = 0; i < this.targets.length; i++) {
      this.observer.observe(this.targets[i]);
    }
  }

  getTargets() {
    const { selector, exclude } = this.options;

    const candidates = Array.from(document.querySelectorAll(selector)).filter((element) => {
      if (element.closest(exclude)) return false;
      // Ignore les éléments sans texte (ex. les <li> qui ne contiennent que des icônes)
      return element.textContent.trim() !== '';
    });

    // Si un élément en contient un autre (ex. <li><p>…</p></li>), on n'anime que le plus profond
    // pour éviter qu'un texte soit animé deux fois.
    return candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));
  }

  watch(entries, observer) {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.isIntersecting) continue;

      // Une seule fois par texte
      observer.unobserve(entry.target);
      this.reveal(entry.target);
    }
  }

  reveal(element) {
    // Les liens ont « transition: 0.5s » dans links.scss : on la coupe pendant l'animation GSAP,
    // sinon la transition CSS amortit chaque image de l'animation.
    element.style.transition = 'none';

    gsap.to(element, {
      opacity: 1,
      y: 0,
      duration: this.options.duration,
      ease: this.options.ease,
      // Une fois fini, on retire les styles inline : le texte retrouve son état CSS normal (survols, etc.)
      clearProps: 'opacity,transform',
      onComplete: () => {
        element.style.transition = '';
      },
    });
  }

  destroy() {
    this.observer?.disconnect();
    gsap.killTweensOf(this.targets);
    gsap.set(this.targets, { clearProps: 'opacity,transform' });
    for (let i = 0; i < this.targets.length; i++) {
      this.targets[i].style.transition = '';
    }
    this.targets = [];
  }
}
