/** @type {(input: string, opts: import('slugify').Options) => string} */
const { default: slugify } = require('slugify');

module.exports = {
  async beforeCreate(event) {
    event.params.data.publishedAt = new Date();
    const { data } = event.params;
    if (data.name) {
      data.slug = slugify(data.name, { lower: true, strict: true });
    }
  },
  async beforeUpdate(event) {
    const { data } = event.params;
    if (data.name) {
      data.slug = slugify(data.name, { lower: true, strict: true });
    }
  },
};
