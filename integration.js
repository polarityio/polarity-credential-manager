'use strict';
const { isCredentialExpiring } = require('./src/is-credential-expiring');
const { setLogger } = require('./src/logger');

let Logger;

function startup(logger) {
  Logger = logger;
  setLogger(logger);
}

async function doLookup(entities, options, cb) {
  Logger.trace({ entities, options }, 'doLookup');
  const lookupResults = [];

  let credentialsExpired = await isCredentialExpiring(options);

  let configuration;
  try {
    if (typeof options.configuration === 'string' && options.configuration.length > 0) {
      configuration = JSON.parse(options.configuration);
    }
  } catch (err) {
    Logger.error({ err }, 'Error parsing configuration JSON');
    return cb({
      detail: 'Unable to parse value of "Configuration" option'
    });
  }
  lookupResults.push({
    entity: {
      ...entities[0],
      value: 'Update Credentials'
    },
    displayValue: 'Update Credentials',
    isVolatile: true,
    data: {
      summary: ['Update Credentials'],
      details: {
        configurationMode: options.configurationMode,
        configuration,
        credentialsExpired
      }
    }
  });
  Logger.trace({ lookupResults }, 'Lookup Results');
  cb(null, lookupResults);
}

module.exports = {
  doLookup,
  startup
};
