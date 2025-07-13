// /src/api/event-page-view/content-types/event-page-view/lifecycles.js
module.exports = {
    async beforeCreate(event) {
      const eventId = event.params.data.event;
  
      if (eventId) {
        const eventEntity = await strapi.entityService.findOne('api::event.event', eventId, {
          fields: ['title'],
        });
  
        if (eventEntity) {
          event.params.data.title = eventEntity.title;
        }
      }
  
      event.params.data.timestamp = new Date().toISOString();
    },
  };
  