'use strict';

/**
 * qr service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::qr.qr');
