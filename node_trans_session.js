//
//  Created by Mingliang Chen on 18/3/9.
//  illuspas[a]gmail.com
//  Copyright (c) 2018 Nodemedia. All rights reserved.
//
const Logger = require('./node_core_logger');

const EventEmitter = require('events');
const { spawn } = require('child_process');
const dateFormat = require('dateformat');
const mkdirp = require('mkdirp');
const fs = require('fs');
const config = require('./knzklive/config');
const aws = require('aws-sdk');
aws.config.accessKeyId = config.s3.accessKey;
aws.config.secretAccessKey = config.s3.secret;
const s3 = new aws.S3({endpoint: config.s3.endpoint});
const axios = require('axios');

class NodeTransSession extends EventEmitter {
  constructor(conf) {
    super();
    this.conf = conf;
  }

  run() {
    let vc = this.conf.vc || 'copy';
    let ac = this.conf.ac || 'copy';
    let inPath = 'rtmp://127.0.0.1:' + this.conf.rtmpPort + this.conf.streamPath;
    let ouPath = `${this.conf.mediaroot}/${this.conf.streamApp}/${this.conf.streamName}`;
    let mapStr = '';
    const random = Math.random().toString(32).substring(2);
    const start = new Date();
    ouPath += this.conf.rec ? `/${random}` : '';

    if (this.conf.rtmp && this.conf.rtmpApp) {
      if (this.conf.rtmpApp === this.conf.streamApp) {
        Logger.error('[Transmuxing RTMP] Cannot output to the same app.');
      } else {
        let rtmpOutput = `rtmp://127.0.0.1:${this.conf.rtmpPort}/${this.conf.rtmpApp}/${this.conf.streamName}`;
        mapStr += `[f=flv]${rtmpOutput}|`;
        Logger.log('[Transmuxing RTMP] ' + this.conf.streamPath + ' to ' + rtmpOutput);
      }
    }
    if (this.conf.mp4) {
      this.conf.mp4Flags = this.conf.mp4Flags ? this.conf.mp4Flags : '';
      let mp4FileName = dateFormat('yyyy-mm-dd-HH-MM') + '.mp4';
      let mapMp4 = `${this.conf.mp4Flags}${ouPath}/${mp4FileName}|`;
      mapStr += mapMp4;
      Logger.log('[Transmuxing MP4] ' + this.conf.streamPath + ' to ' + ouPath + '/' + mp4FileName);
    }
    if (this.conf.hls) {
      this.conf.hlsFlags = this.conf.hlsFlags ? this.conf.hlsFlags : '';
      let hlsFileName = 'index.m3u8';
      let mapHls = `[${this.conf.hlsFlags}:hls_segment_filename=\'${ouPath}/misskeylive_archive_%d.ts\']${ouPath}/${hlsFileName}|`;
      mapStr += mapHls;
      Logger.log('[Transmuxing HLS] ' + this.conf.streamPath + ' to ' + ouPath + '/' + hlsFileName);
    }
    if (this.conf.dash) {
      this.conf.dashFlags = this.conf.dashFlags ? this.conf.dashFlags : '';
      let dashFileName = 'index.mpd';
      let mapDash = `${this.conf.dashFlags}${ouPath}/${dashFileName}`;
      mapStr += mapDash;
      Logger.log('[Transmuxing DASH] ' + this.conf.streamPath + ' to ' + ouPath + '/' + dashFileName);
    }
    mkdirp.sync(ouPath);

    let argv = ['-y', '-flags', 'low_delay', '-fflags', 'nobuffer', '-analyzeduration', '2147483647', '-probesize', '2147483647', '-i', inPath];
    Array.prototype.push.apply(argv, ['-c:v', vc]);
    Array.prototype.push.apply(argv, this.conf.vcParam);
    Array.prototype.push.apply(argv, ['-c:a', ac]);
    Array.prototype.push.apply(argv, this.conf.acParam);
    if (this.conf.rec) {
      Array.prototype.push.apply(argv, ['-t', '14400']);
    }
    Array.prototype.push.apply(argv, ['-f', 'tee', '-map', '0:a?', '-map', '0:v?', mapStr]);
    argv = argv.filter((n) => { return n }); //去空
    this.ffmpeg_exec = spawn(this.conf.ffmpeg, argv);
    this.ffmpeg_exec.on('error', (e) => {
      Logger.ffdebug(e);
    });

    this.ffmpeg_exec.stdout.on('data', (data) => {
      Logger.ffdebug(`FF输出：${data}`);
    });

    this.ffmpeg_exec.stderr.on('data', (data) => {
      Logger.ffdebug(`FF输出：${data}`);
    });

    this.ffmpeg_exec.on('close', (code) => {
      Logger.log('[Transmuxing end] ' + this.conf.streamPath);
      this.emit('end');
      const rec = this.conf.rec;
      const date = new Date();
      const key = `live/archives/${date.getFullYear()}_${(`0${date.getMonth() + 1}`).slice(-2)}/${random}/`;
      fs.readdir(ouPath, function (err, files) {
        if (!err) {
          files.forEach((filename) => {
            if (filename.endsWith('.ts')
              || filename.endsWith('.m3u8')
              || filename.endsWith('.mpd')
              || filename.endsWith('.m4s')
              || filename.endsWith('.tmp')) {
              const path = ouPath + '/' + filename;
              if (!rec) return fs.unlinkSync(path);
              s3.upload({
                Bucket: config.s3.bucket,
                Key: key + filename,
                Body: fs.createReadStream(path)
              }, err1 => {
                if (err1) console.error(err1);
                fs.unlinkSync(path);
              });
            }
          })
        }
      });

      if (!rec) return;

      axios.get(`https://live-api.arkjp.net/public/thumbnails/${this.conf.streamName}.jpg?v=${(new Date().getTime() - 15000) / 60000}`, {
        responseType: 'arraybuffer'
      }).then(value => {
          s3.upload({
            Bucket: config.s3.bucket,
            Key: key + 'thumbnail.jpg',
            Body: value.data
          }, err1 => {
            if (err1) console.error(err1);
          });
        });

      axios.get(
        `${config.endpoint}archive.php?authorization=${
          config.APIKey
        }&user=${this.conf.streamName}&duration=${((date - start) / 1000).toFixed()}&id=${random}&thumbnail=${
          encodeURIComponent(`https://s3.arkjp.net/${key}thumbnail.jpg`)
        }&stream=${encodeURIComponent(`https://s3.arkjp.net/${key}index.m3u8`)}`);
    });
  }

  end() {
    // this.ffmpeg_exec.kill();
  }
}

module.exports = NodeTransSession;
