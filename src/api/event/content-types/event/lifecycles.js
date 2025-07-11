// path: src/api/event/content-types/event/lifecycles.js
const slugify = require('slugify');

module.exports = {
  beforeCreate(event) {
    event.params.data.slug = slugify(event.params.data.title || '', { lower: true });
  },
  beforeUpdate(event) {
    if (event.params.data.title) {
      event.params.data.slug = slugify(event.params.data.title, { lower: true });
    }
  },
};
