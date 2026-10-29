// Tuned SVGO 4.1.0 config for hand-made logos/icons: keep accessibility, ids used by site CSS / aria / animation, and the viewBox.
export default {
  multipass: true,
  js2svg: { indent: 0, pretty: false },
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // removeViewBox and removeTitle are NOT in preset-default since svgo 4 (configuring them there errors); nothing to disable
          removeDesc: false,           // preset removes "Created with ..." descs; keep every desc
          cleanupIds: false,           // ids are targeted by site CSS (#accent), aria-labelledby, CSS animations
          inlineStyles: false,         // keep <style> blocks (theme overrides, @keyframes)
          minifyStyles: false,         // keeps selectors/keyframes byte-identical
          removeUnknownsAndDefaults: { keepRoleAttr: true, keepAriaAttrs: true },
          removeHiddenElems: false,    // display:none layers may be toggled by script/CSS
        },
      },
    },
  ],
};
