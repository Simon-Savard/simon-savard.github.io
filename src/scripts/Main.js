import ComponentFactory from "./ComponentFactory.js";
import SplashCursor from "./components/SplashCursor.js";
import ClickSpark from "./components/ClickSpark.js";
import TextReveal from "./components/TextReveal.js";
import Icons from "./utils/Icons.js";
import { MOBILE_QUERY } from "./utils/Breakpoints.js";

class Main {
  constructor() {
    this.init();
  }

  init() {
    document.documentElement.classList.add("has-js");

    new ComponentFactory();
    new TextReveal();
    this.initSplashCursor();
    new ClickSpark({
      sparkColor: "#fff",
      shape: "line",
      sparkCount: 8,
      sparkSize: 14,
      sparkRadius: 30,
      duration: 500,
    });

    Icons.load();

    this.initCardVideos();
  }

  // Le SplashCursor suit le curseur : il n'a pas de sens sur mobile.
  // Il est retiré en mode mobile et revient si on repasse en mode bureau (redimensionnement).
  initSplashCursor() {
    const mobileQuery = window.matchMedia(MOBILE_QUERY);
    this.splashCursor = null;

    const update = () => {
      if (mobileQuery.matches) {
        this.splashCursor?.destroy();
        this.splashCursor = null;
      } else if (!this.splashCursor) {
        this.splashCursor = new SplashCursor();
      }
    };

    update();
    mobileQuery.addEventListener("change", update);
  }

  // Les vidéos des tuiles ne se chargent et ne jouent qu'au survol (ou au focus clavier).
  // preload="none" + poster dans le HTML : rien n'est téléchargé tant que la tuile n'est pas utilisée.
  initCardVideos() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = document.querySelectorAll(".card");

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const video = card.querySelector(".video-cover");

      // Certaines tuiles n'ont qu'une image
      if (!video || reducedMotion) continue;

      const play = () => {
        // play() retourne une promesse : on ignore l'erreur si elle est interrompue par un pause()
        video.play().catch(() => {});
      };
      const pause = () => video.pause();

      card.addEventListener("mouseenter", play);
      card.addEventListener("mouseleave", pause);
      card.addEventListener("focusin", play);
      card.addEventListener("focusout", pause);
    }
  }
}
new Main();
