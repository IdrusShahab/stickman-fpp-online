module.exports = {
  apps: [{
    name: 'stickman',
    script: 'server.js',
    env: {
      PORT: 3000,
      BASE_PATH: '/fppstickman'
    }
  }]
};