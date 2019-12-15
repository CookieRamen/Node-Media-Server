const NodeMediaServer = require('../node_media_server');
const axios = require('axios');
// eslint-disable-next-line import/no-unresolved
const conf = require('./config');

const IS_DEBUG = process.env.NODE_ENV === 'development';

const config = {
  logType: IS_DEBUG ? 4 : 2,
  auth: {
    api : true,
    api_user: conf.api_user,
    api_pass: conf.api_pass
  },
  rtmp: {
    port: 1935,
    chunk_size: 100000,
    gop_cache: false,
    ping: 60,
    ping_timeout: 30
  },
  http: {
    port: conf.http_port,
    allow_origin: '*',
    mediaroot: './media'
  },
  knzklive: {
    api_endpoint: conf.endpoint,
    api_key: conf.APIKey,
    ignore_auth: !!IS_DEBUG
  }
};

if (conf.https_port) {
  config.https = {
    port: conf.https_port,
    cert: conf.https_cert,
    key: conf.https_key
  };
}

if (conf.ffmpeg_path) {
  const tasks = [
    {
      app: 'live',
      ac: 'copy',
      vc: 'copy',
      hls: true,
      hlsFlags: 'hls_time=1:hls_list_size=3:hls_flags=delete_segments'
    },
    {
      app: 'live',
      ac: 'copy',
      vc: 'copy',
      hls: true,
      rec: true,
      hlsFlags: 'hls_time=15:hls_list_size=0'
    }
  ];

  config.trans = {
    ffmpeg: conf.ffmpeg_path,
    tasks
  };
}

const nms = new NodeMediaServer(config);
nms.run();

nms.on('onMetaData', (id, v) => {
  const max = conf.max_bitRate || 30 * 1000;
  if (v.videodatarate > max) {
    console.warn('[bitrate limiter]', `${v.videodatarate}kbps`);
    nms.getSession(id).reject();
  }
});
