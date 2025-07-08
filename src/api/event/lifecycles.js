// src/api/event/content-types/event/lifecycles.js
const slugify = require('slugify');

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    if (data.title) {
      data.slug = slugify(data.title, {
        lower:       true,
        strict:      true,
        replacement: '-'  // use hyphens between words
      });
    }
  },

  async beforeUpdate(event) {
    const { data } = event.params;
    if (data.title) {
      data.slug = slugify(data.title, {
        lower:       true,
        strict:      true,
        replacement: '-' 
      });
    }
  },
};
