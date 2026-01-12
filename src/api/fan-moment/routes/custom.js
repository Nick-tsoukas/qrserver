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
  ],
};
