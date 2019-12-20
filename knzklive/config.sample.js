module.exports = {
  endpoint: 'https://live.knzk.me/api/pubsv/',
  APIKey: 'xxxxx',
  http_port: 8000,
  /*
  https_port: 8443,
  https_cert: '/path/to/cert.pem',
  https_key: '/path/to/key.pem',
  ffmpeg_path: '/path/to/ffmpeg',
  */
  s3: {
    accessKey: '',
    secret: '',
    bucket: '',
    endpoint: '',
    concurrency: 4,
    publishUrl: ''
  },
  max_bitRate: 30 * 1000, // 30mbps
  bitRate_check_interval: 3, // sec
  bitRate_check_count: 5
};
