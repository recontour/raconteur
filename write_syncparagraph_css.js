const fs = require('fs');
const css = `/* SyncParagraph — word-reveal prose
   Words fade in as audio plays. Unspoken words are faint (pale ink).
   No scrolling — text fills the page like a real book. */

.prose {
  flex: 1;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1.02rem;
  line-height: 1.92;
  text-align: justify;
  hyphens: auto;
  letter-spacing: 0.01em;
  color: inherit;
  text-indent: 2em;
  overflow: hidden;
  mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
}

.word {
  transition: opacity 0.35s ease;
  display: inline;
}

.spoken {
  opacity: 1;
}

.unspoken {
  opacity: 0.13;
}

.current {
  text-shadow: 0 0 12px rgba(160, 100, 30, 0.55);
}

.dark.prose {
  color: #e2d5bc;
}

.dark .current {
  text-shadow: 0 0 14px rgba(220, 170, 60, 0.50);
}
`;
fs.writeFileSync('components/SyncParagraph.module.css', css);
console.log('Written', css.split('\n').length, 'lines');
