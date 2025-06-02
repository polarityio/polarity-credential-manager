const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const SUCCESS_CODES = [200];

/**
 * Checks if the user's API Key (`options.apiKey`) is expiring.  If the `apiKey` is expiring, this 
 * method should return the boolean value `true`.  This will prompt the user to update their "API Key" 
 * via the Overlay Window.
 * 
 * If the API key is not expiring, this method should return `false.
 *
 * @param {Object} options - The options containing the API key and other configurations.
 * @param {string} options.apiKey - The API key to check for expiration.
 * @returns {Promise<boolean>} - Returns `true` if the credential is expiring or the API key is missing.
 */
async function isCredentialExpiring(options) {
  const Logger = getLogger();

  // If no API key value is set then we need to prompt the user to enter their key
  if (!options.apiKey) {
    return true;
  }


  // The following commented out code provides the skeleton logic needed to make a REST request
  // to an endpoint that can return whether the API Key is expiring.  Typically, the endpoint
  // will return an expiration time that the integration can use to determine if the API Key
  // is about to expire.
  
  // const requestOptions = {
  //   uri: `https://api-key-check`,
  //   qs: {
  //     access_key: options.apiKey
  //   }
  // };
  //
  // Logger.trace({ requestOptions }, 'Is Credential Expiring Request Options');
  //
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

  
  // For demonstration purposes we are always returning `true`
  return true;
}

module.exports = {
  isCredentialExpiring
};
