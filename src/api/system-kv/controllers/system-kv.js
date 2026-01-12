'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::system-kv.system-kv');
