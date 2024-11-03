'use strict';

/**
 * funtest service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::funtest.funtest');
