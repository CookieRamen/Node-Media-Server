const config = require('./knzklive/config');
const tus = require('tus-js-client');
const fs = require('fs');
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

/*
const random = process.argv[2];
const streamName = process.argv[3];
const key = process.argv[4];
const duration = process.argv[5];
*/
const ouPath = process.argv[6];

try {
  const archivePath = `${ouPath}/archive.ts`;
  const stream = fs.createReadStream(archivePath);
  let mediaId;
  const upload = new tus.Upload(stream, {
    endpoint: `https://api.cloudflare.com/client/v4/accounts/${config.cloudflare.stream.account}/stream`,
    headers: {
      Authorization: `Bearer ${config.cloudflare.stream.token}`
    },
    chunkSize: 50 * 1024 * 1024,
    uploadSize: fs.statSync(archivePath).size,
    onAfterResponse: async (req, res) => {
      mediaId = res.getHeader('stream-media-id');
      await admin.firestore().collection('archives').doc(mediaId).set({
        deleteLock: false,
        desc: '',
        id: mediaId,
        public: true,
        timestamp: admin.firestore.Timestamp.now(),
        title: '',
        uploaded: false,
        user: null
      });
    },
    onSuccess: async () => {
      await admin.firestore().collection('archives').doc(mediaId).set({
        uploaded: true
      }, {merge: true});
      fs.rmdirSync()
      fs.rmSync(ouPath, {recursive: true});
    },
    onError: async err => {
      console.error(err);
      await admin.firestore().collection('archives').doc(mediaId).delete();
    }
  });
  upload.start();
} catch (e) {
  console.error(e);
  return;
}
