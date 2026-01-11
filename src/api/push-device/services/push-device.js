'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::push-device.push-device');
