'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/fan-moments/earn',
      handler: 'fan-moment.earn',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/fan-moments/active',
      handler: 'fan-moment.active',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/fan-moments/shared',
      handler: 'fan-moment.shared',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/fan-moments/evaluate-auto',
      handler: 'fan-moment.evaluateAuto',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/fan-moments/auto-active',
      handler: 'fan-moment.autoActive',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/fan-moments/evaluate-recap',
      handler: 'fan-moment.evaluateRecap',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/fan-moments/recap-active',
      handler: 'fan-moment.recapActive',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/fan-moments/system-status',
      handler: 'fan-moment.systemStatus',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
