import TextAnim from './components/TextAnim.js';
import Scroller from './components/Scroller.js';
import Header from './components/Header.js';
import Youtube from './components/Youtube.js';
import Scrolly from './components/Scrolly.js';
import Carousel from './components/Carousel.js';
import Topography from './components/Topography.js';
import RippleDistortion from './components/RippleDistortion.js';
import Modale from './components/Modale.js';
import OrbitImages from './components/OrbitImages.js';
import Ballpit from './components/Ballpit.js';


export default class ComponentFactory {
  constructor() {
    this.componentInstances = [];
    this.componentList = {
      TextAnim,
      Scroller,
      Header,
      Youtube,
      Scrolly,
      Carousel,
      Topography,
      RippleDistortion,
      Modale,
      OrbitImages,
      Ballpit,

    };
    this.init();
  }
  init() {
    const components = document.querySelectorAll('[data-component]');

    for (let i = 0; i < components.length; i++) {
      const element = components[i];
      const componentName = element.dataset.component;

      if (this.componentList[componentName]) {
        const instance = new this.componentList[componentName](element);
        this.componentInstances.push(instance);
      } else {
        console.log(`La composante ${componentName} n'existe pas`);
      }
    }
  }
}
