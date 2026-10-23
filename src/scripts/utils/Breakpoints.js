// Points de rupture partagés par le JS.
// Garder la même valeur que $breakpoint-mobile dans styles/settings/dimensions.scss
export const MOBILE_MAX_WIDTH = 400;

// Vrai quand le site est en mode mobile (400px de large et moins)
export const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

// Le contraire exact de MOBILE_QUERY (mode bureau)
export const DESKTOP_QUERY = `not all and ${MOBILE_QUERY}`;
