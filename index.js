import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import chalk from 'chalk';

import Entry from './models/entry.js';
import config from './utils/config.js';
import logger from './utils/logger.js';

const app = express();
app.use(express.static('dist'));
app.use(cors());
app.use(express.json());

morgan.token('body', (request) => JSON.stringify(request.body));
app.use(morgan((tokens, request, response) => {
  return [
    chalk.green.bold(tokens.method(request, response)),
    tokens.body(request) !== '{}' ? tokens.body(request) : '',
    chalk.cyan(tokens.url(request, response)),
    chalk.yellow.bold(tokens.status(request, response)),
    tokens.res(request, response, 'content-length'), '-',
    'took', tokens['response-time'](request, response), 'ms'
  ].join(' ');
}));

// POST
app.post('/api/entries', (request, response, next) => {
  const body = request.body;
  const entry = new Entry({
    name: body.name,
    number: body.number,
  });
  entry.save()
    .then((savedEntry) => response.json(savedEntry))
    .catch((error) => next(error));
});

// GET
app.get('/', (request, response) => {
  response.send('<h1>Hello, world!</h1>');
});

app.get('/api/entries', (request, response) => {
  Entry.find({}).then((entries) => response.json(entries));
});

app.get('/info', (request, response) => {
  Entry.find({}).then((entries) => {
    return (
      response.send(`
        <p>Phonebook has info for ${entries.length} people</p>
        <p>${Date()}</p>
    `));
  });
});

app.get('/api/entries/:id', (request, response, next) => {
  Entry.findById(request.params.id)
    .then((entry) => {
      if (entry) {
        response.json(entry);
      } else {
        response.status(404).end();
      }
    })
    .catch((error) => next(error));
});

// PUT
app.put('/api/entries/:id', (request, response, next) => {
  const { name, number } = request.body;
  Entry.findByIdAndUpdate(
    request.params.id,
    { name, number },
    { new: true, runValidators: true, context: 'query' }
  )
    .then((updatedEntry) => response.json(updatedEntry))
    .catch((error) => next(error));
});

// DELETE
app.delete('/api/entries/:id', (request, response, next) => {
  Entry.findByIdAndDelete(request.params.id)
    .then((result) => {
      if (result) {
        response.status(204).end();
      } else {
        response.status(404).send({
          error: 'Resource already deleted or doesn\'t exist'
        });
      }
    })
    .catch((error) => next(error));
});

// Unknown endpoint handler
function unknownEndpoint(request, response) {
  return response.status(404).send({ error: 'Unknown endpoint' });
}

app.use(unknownEndpoint);

// Error handler
function errorHandler(error, request, response, next) {
  logger.error(error.message);

  if (error.name === 'CastError') {
    return response.status(400).send({ error: 'Malformatted ID' });
  } else if (error.name === 'ValidationError') {
    return response.status(400).send({ error: error.message });
  } else {
    next(error);
  }
}

app.use(errorHandler);

// Run server.
app.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`);
});
