module.exports = {
    async beforeCreate(event) {
      event.params.data.publishedAt = new Date();
    },
  };