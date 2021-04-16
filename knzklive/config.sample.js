module.exports = {
  ArchiveUrl: 'https://example.com/api/pubsv/archive.php',
  APIUrl: 'https://live.knzk.me/api/pubsv/publish.php',
  APIKey: 'xxxxx',
  http_port: 8000,
  ws_port: 3000,
  /*
  https_port: 8443,
  https_cert: '/path/to/cert.pem',
  https_key: '/path/to/key.pem',
  ffmpeg_path: '/path/to/ffmpeg',
  */
  cloudflare: {
    stream: {
      account: '',
      token: ''
    }
  },
  max_bitRate: 30 * 1000, // 30mbps
  bitRate_check_interval: 3, // sec
  bitRate_check_count: 5
};
