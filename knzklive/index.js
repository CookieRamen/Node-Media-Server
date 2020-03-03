const NodeMediaServer = require('../node_media_server');
const { error } = require('../node_core_logger');
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
    ignore_auth: !!IS_DEBUG,
    max_bitRate: conf.max_bitRate || 30 * 1000,
    bitRate_check_interval: conf.bitRate_check_interval || 3,
    bitRate_check_count: conf.bitRate_check_count || 5
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
  const max = config.knzklive.max_bitRate;
  if (v.videodatarate > max) {
    error('[bitrate limiter]', `${v.videodatarate / 1000}Mbps`);
    nms.getSession(id).reject();
  }
});

const viewers = new Map();
const url = require('url');

const server = require('http').createServer((req, res) => {
  const id = url.parse(req.url, true).query.id;
  if (!id) {
    res.writeHead(400);
    res.end();
    return;
  }
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({count: [...viewers.values()].filter(value => value === id).length}));
}).listen(conf.ws_port);

const io = require('socket.io')(server);
const child_process = require('child_process');
io.on('connection', socket => {
  let ffmpeg;
  socket.on('start', user => {
    if (!user || !user.stream_key) return;
    if (ffmpeg) return;
    ffmpeg = child_process.spawn(conf.ffmpeg_path, ['-y', '-flags', 'low_delay', '-fflags', 'nobuffer', '-analyzeduration', '2147483647', '-probesize', '2147483647', '-i', '-', '-f', 'lavfi', '-i', 'anullsrc', '-c:v', 'copy', '-c:a', 'aac', '-async', '1', '-f', 'flv', `rtmp://127.0.0.1/live/${user.stream_key}`]);
    ffmpeg.on('close', () => socket.emit('stop'));
  });
  socket.on('video', data => {
    if (!ffmpeg || !ffmpeg.stdin.writable) return;
    ffmpeg.stdin.write(data);
  });

  socket.on('watching', id => {
    if (!id) return;
    viewers.set(socket.id, id);
  });

  socket.on('disconnect', () => {
    if (ffmpeg) {
      ffmpeg.kill();
    }
    viewers.delete(socket.id);
  });
});
