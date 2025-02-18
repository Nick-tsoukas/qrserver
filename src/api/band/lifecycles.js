// src/api/band/content-types/band/lifecycles.js

const slugify = require('slugify'); // Import the slugify package

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    // Check if the band name exists and generate the slug
    if (data.name) {
      data.slug = slugify(data.name, { lower: true, strict: true });
    }
  },

  async beforeUpdate(event) {
    const { data } = event.params;

    // If the band name is updated, update the slug as well
    if (data.name) {
      data.slug = slugify(data.name, { lower: true, strict: true });
    }
  },
};
