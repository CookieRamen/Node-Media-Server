const config = require('./knzklive/config');
const aws = require('aws-sdk');
aws.config.accessKeyId = config.s3.accessKey;
aws.config.secretAccessKey = config.s3.secret;
const s3 = new aws.S3({endpoint: config.s3.endpoint});
const fs = require('fs');
const axios = require('axios');

const random = process.argv[2];
const streamName = process.argv[3];
const key = process.argv[4];
const duration = process.argv[5];
const ouPath = process.argv[6];

(async () => {
  try {
    const thumb = await axios.get(`https://live-api.arkjp.net/public/thumbnails/${streamName}.jpg?v=${(new Date().getTime() - 15000) / 60000}`,
      {responseType: 'arraybuffer'});
    s3.upload({
      Bucket: config.s3.bucket,
      Key: key + 'thumbnail.jpg',
      Body: thumb.data
    }, err => {
      if (err) console.error(err);
    });
  } catch (e) {
    console.error(e);
  }

  fs.readdirSync(ouPath).forEach((filename) => {
    if (filename.endsWith('.ts')
      || filename.endsWith('.m3u8')
      || filename.endsWith('.mpd')
      || filename.endsWith('.m4s')
      || filename.endsWith('.tmp')) {
      const path = ouPath + '/' + filename;
      s3.upload({
        Bucket: config.s3.bucket,
        Key: key + filename,
        Body: fs.createReadStream(path)
      }, err => {
        if (err) console.error(err);
        fs.unlinkSync(path);
      });
    }
  });

  await axios.get(
    `${config.endpoint}archive.php?authorization=${
      config.APIKey
    }&user=${streamName}&duration=${duration}&id=${random}&thumbnail=${
      encodeURIComponent(`https://s3.arkjp.net/${key}thumbnail.jpg`)
    }&stream=${encodeURIComponent(`https://s3.arkjp.net/${key}index.m3u8`)}`);
})();
