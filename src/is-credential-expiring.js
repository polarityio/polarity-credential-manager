const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const SUCCESS_CODES = [200];

async function isCredentialExpiring(options) {
  const Logger = getLogger();

  // If no API key value is set then we need to prompt the user to enter their key
  if (!options.apiKey) {
    return true;
  }

  const requestOptions = {
    uri: `https://api.userstack.com/detect`,
    qs: {
      access_key: options.apiKey
    }
  };

  Logger.trace({ requestOptions }, 'Request Options');

  // const apiResponse = await polarityRequest.request(requestOptions, options);
  //
  // Logger.trace({ apiResponse }, 'Is Credential Expiring API Response');
  //
  // if (!SUCCESS_CODES.includes(apiResponse.statusCode)) {
  //   throw new ApiRequestError(
  //     `Unexpected status code ${apiResponse.statusCode} received when making request to the ISC IP API`,
  //     {
  //       statusCode: apiResponse.statusCode,
  //       requestOptions,
  //       responseBody: apiResponse.body
  //     }
  //   );
  // }

  return true;
}

module.exports = {
  isCredentialExpiring
};
