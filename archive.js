const config = require('./knzklive/config');
const tus = require('tus-js-client');
const fs = require('fs');
const axios = require('axios');

const random = process.argv[2];
const streamName = process.argv[3];
const key = process.argv[4];
const duration = process.argv[5];
const ouPath = process.argv[6];

try {
  const archivePath = `${ouPath}/archive.ts`;
  const stream = fs.createReadStream(archivePath);
  const upload = new tus.Upload(stream, {
    endpoint: `https://api.cloudflare.com/client/v4/accounts/${config.cloudflare.stream.account}/stream`,
    headers: {
      Authorization: `Bearer ${config.cloudflare.stream.token}`
    },
    chunkSize: 50 * 1024 * 1024,
    uploadSize: fs.statSync(archivePath).size,
    onAfterResponse: (req, res) => {
      const mediaId = res.getHeader('stream-media-id');
      console.log({mediaId});
    }
  });
  upload.start();
} catch (e) {
  console.error(e);
  return;
}

/*
setTimeout(() => fs.rmdirSync(ouPath), 10000);
axios.get(
  `${config.ArchiveUrl}?authorization=${
    config.APIKey
  }&user=${streamName}&duration=${duration}&id=${random}&thumbnail=${
    encodeURIComponent(`https://${config.s3.publishUrl}/${key}thumbnail.jpg`)
  }&stream=${encodeURIComponent(`https://${config.s3.publishUrl}/${key}index.m3u8`)}`);
 */
