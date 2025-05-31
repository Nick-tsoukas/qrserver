/** @type {(input: string, opts: import('slugify').Options) => string} */
const { default: slugify } = require('slugify');

module.exports = {
  async beforeCreate(event) {
    // (you already set publishedAt if needed)
    const { data } = event.params;
    if (data.name) {
      data.slug = slugify(data.name, {
        replacement: '', // ← remove spaces/hyphens entirely
        lower: true,
        strict: true
      });
    }
  },
  async beforeUpdate(event) {
    const { data } = event.params;
    if (data.name) {
      data.slug = slugify(data.name, {
        replacement: '',
        lower: true,
        strict: true
      });
    }
  }
};
