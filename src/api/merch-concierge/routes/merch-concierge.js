'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/merch-concierge/create-checkout',
      handler: 'merch-concierge.createCheckout',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/merch-concierge/order/:orderCode',
      handler: 'merch-concierge.getOrder',
      config: { auth: false },
    },
  ],
};
