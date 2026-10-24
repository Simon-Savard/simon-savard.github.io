import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';
import { ScrollSmoother } from 'gsap/ScrollSmoother.js';

export default class Scroller {
  constructor(element) {
    gsap.registerPlugin(ScrollSmoother, ScrollTrigger);
    this.options = {
      hasSkew: false,
      hasPinItems: false,
    };
    this.element = element;
    this.setOptions();
    this.init();
  }

  init() {
    this.smoother = ScrollSmoother.create({
      smooth: 2,
      effects: true,
      smoothTouch: 0.1,
      onUpdate: this.onUpdateScroll.bind(this),
      onStop: this.onStopScroll.bind(this),
      ease: 'expo.out',
    });

    this.initAnchors();
  }

  // Liens d'ancre (ex. « Me contacter » → #footer).
  // Avec ScrollSmoother, le navigateur ne doit pas gérer l'ancre lui-même : il fait défiler le
  // #smooth-wrapper (overflow: hidden) au lieu de la page, ce qui décale le contenu pour de bon
  // (impossible de remonter, on peut défiler au-delà du footer). On passe donc par smoother.scrollTo.
  initAnchors() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;

      const hash = link.getAttribute('href');
      if (hash.length < 2) return;

      const target = document.querySelector(hash);
      if (!target) return;

      event.preventDefault();

      // Ferme le menu mobile (il bloque le défilement du body tant qu'il est ouvert)
      document.documentElement.classList.remove('nav-is-active');

      this.smoother.scrollTo(target, true, 'top top');
    });

    // Filet de sécurité : le wrapper ne doit jamais défiler lui-même (ex. focus clavier sur un élément hors écran)
    this.element.addEventListener('scroll', () => {
      this.element.scrollTop = 0;
      this.element.scrollLeft = 0;
    });
  }

  onUpdateScroll(self) {
    if (this.options.hasSkew) this.updateSkew(self);
  }

  onStopScroll(self) {
    if (this.options.hasSkew) this.stopSkew(self);
  }

  initSkew() {
    this.skewSetter = gsap.quickTo('img', 'skewY');
  }

  updateSkew(self) {
    const velocity = self.getVelocity();
    const force = 5;
    let skew = gsap.utils.mapRange(-1000, 1000, -force, force, velocity);
    skew = gsap.utils.clamp(-force, force, skew);

    this.skewSetter(skew);
  }

  stopSkew() {
    this.skewSetter(0);
  }

  initPins() {
    console.log('oh my gog');

    const pinnedItems = this.element.querySelectorAll('.js-pinned');
    console.log(pinnedItems);
    for (let i = 0; i < pinnedItems.length; i++) {
      const pinnedItem = pinnedItems[i];

      ScrollTrigger.create({
        pin: pinnedItem,
        trigger: pinnedItem.parentElement,
        start: 'center center',
        end: '80% center',
      });
    }
  }

  initHoriz() {
    const sectionHoriz = this.element.querySelector('.js-horiz');

    //queryselectorall horiz
    //boucle dans sections
    //createhoriz

    const panels = sectionHoriz.querySelectorAll('.js-panel');
    const nbPanels = panels.length - 1;
    const buffer = 200;
    console.log(nbPanels);

    // Le défilement horizontal n'existe qu'au-dessus du breakpoint mobile.
    // La valeur vient du CSS (--breakpoint-mobile, définie par $breakpoint-mobile dans dimensions.scss).
    // En mode mobile, gsap.matchMedia annule l'animation, le pin et le snap : les étapes s'empilent (CSS).
    const mobileMax = getComputedStyle(document.documentElement)
      .getPropertyValue('--breakpoint-mobile')
      .trim() || '400px';

    gsap.matchMedia().add(`(width > ${mobileMax})`, () => {
      gsap.to(panels, {
        xPercent: -100 * nbPanels,
        ease: 'none',
        scrollTrigger: {
          pin: true,
          trigger: sectionHoriz,
          scrub: 1,
          snap: 1 / nbPanels,
          end: () => '+=' + (sectionHoriz.offsetWidth + buffer),
        },
      });
    });
  }

  setOptions() {
    if ('skew' in this.element.dataset) {
      this.options.hasSkew = true;
      this.initSkew();
    }

    if ('pinItems' in this.element.dataset) {
      this.options.hasPinItems = true;
      this.initPins();
    }

    if (this.element.querySelector('.js-horiz')) {
      this.initHoriz();
    }
  }
}
