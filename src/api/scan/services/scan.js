'use strict';

/**
 * scan service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::scan.scan');
