// src/api/media-play/content-types/media-play/lifecycles.js
'use strict';

module.exports = {
  async beforeCreate(event) {
    const data = event.params.data || {};
    if (!data.timestamp) data.timestamp = new Date().toISOString();
  },
};
