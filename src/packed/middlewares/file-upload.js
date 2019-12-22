const busboy = require('busboy');
const { createWriteStream } = require('fs');
const { mimes } = require('../../helpers/mime');

const mimeKeys = Object.keys(mimes);
const mimeValues = Object.values(mimes);
module.exports = () => {
  const middleware = (req, res, next) => {
    // eslint-disable-next-line prefer-const
    let { headers, body } = req;

    if (headers && body) {
      const contentType = headers['content-type'];
      if (contentType) {
        if (contentType.indexOf('multipart/form-data') === 0) {
          const form = new busboy(req);
          form.on('field', (key, value) => {
            if (typeof body !== 'object' || body.length) {
              req.body = {};
              body = req.body;
            }
            body[key] = value;
          });
          form.on('file', (key, file, filename, encoding, mime) => {
            if (!req.files) {
              req.files = [];
            }
            file.field = key;
            file.filename = filename;
            file.encoding = encoding;
            file.mime = mime;
            file.extension = filename.substr(filename.indexOf('.'));
            file.type = file.extension.substr(1);

            file.mv = (filePath) =>
              new Promise((resolve, reject) => {
                const stream = createWriteStream(filePath);
                file.pipe(stream);
                stream.on('finish', resolve);
                stream.on('error', reject);
              });

            req.files.push(file);
          });
          req.pipe(form);
          next();
        } else {
          const mimeIndex = mimeValues.findIndex(
            (value) => value === contentType
          );

          // Binary upload support
          if (mimeIndex !== -1) {
            const mimeType = mimeKeys[mimeIndex];

            if (!req.files) {
              req.files = [];
            }

            const file = {
              type: mimeType,
              extension: '.' + mimeType,
              buffer: { data: body }
            };
            req.body = null;

            file.mv = (filePath) =>
              new Promise((resolve, reject) => {
                const stream = createWriteStream(filePath);
                stream.write(file.buffer.data);
                stream.end();
                stream.on('finish', resolve);
                stream.on('error', reject);
              });
            req.files.push(file);
          }

          next();
        }
      }
    }
  };
  middleware.methods = 'POST, PUT';

  return middleware;
};
