// src/api/band/content-types/band/lifecycles.js
const slugify = require('slugify');

module.exports = {
  // ← directly export the hooks, no "lifecycles" wrapper
  async beforeCreate(event) {
    const { data } = event.params;
    if (data.name) {
      data.slug = slugify(data.name, {
        lower:       true,
        strict:      true,
        replacement: ''  // no hyphens, just mash together
      });
    }
  },

  async beforeUpdate(event) {
    const { data } = event.params;
    if (data.name) {
      data.slug = slugify(data.name, {
        lower:       true,
        strict:      true,
        replacement: ''
      });
    }
  },
};
