const { getLogger } = require('./logger');

/**
 *
 * @param entities
 * @param apiResponse
 * @returns {*[]}
 */
const createResultObject = (entity, apiResponse, options) => {
  if (
    apiResponse &&
    apiResponse.ip &&
    (!options.ignoreZeroCount ||
      (options.ignoreZeroCount && apiResponse.ip.count !== null))
  ) {
    return {
      entity,
      data: {
        summary: createSummary(apiResponse, options),
        details: apiResponse
      }
    };
  } else {
    return {
      entity,
      data: null
    };
  }
};

/**
 * Creates the Summary Tags (currently just tags for ports)
 * @param match
 * @returns {string[]}
 */
const createSummary = (apiResponse, options) => {
  const tags = [];

  if (apiResponse.ip && apiResponse.ip.maxrisk !== null) {
    tags.push(`Max Risk: ${apiResponse.ip.maxrisk}`);
  }

  if (apiResponse.ip && apiResponse.ip.threatfeeds) {
    tags.push(`Threat Feeds: ${Object.keys(apiResponse.ip.threatfeeds).length}`);
  }

  if (tags.length === 0 && apiResponse.ip.weblogs) {
    tags.push(`Logs: ${apiResponse.ip.weblogs.count}`);
  }

  if (tags.length === 0 && apiResponse.ip.count) {
    tags.push(`Count: ${apiResponse.ip.count}`);
  }

  if (tags.length === 0 && apiResponse.ip.asname) {
    tags.push(`AS: ${apiResponse.ip.asname}`);
  }

  return tags;
};

module.exports = {
  createResultObject
};
