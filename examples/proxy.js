import nanoexpress from '../src/nanoexpress.js';

import { proxy } from '../src/packed/defines/index.js';

const app = nanoexpress();

app
  .define(proxy)
  .proxy('/proxy', {
    url: 'https://jsonplaceholder.typicode.com/todos/1',
    method: 'GET'
  },
  // ws // If you want proxy WebSocket too)
  .get('/health', (req, res) => res.send({ status: 'ok' }));

app.listen(4044);
