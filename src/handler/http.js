import { http } from '../wrappers';
import { prepareValidation, isSimpleHandler } from '../helpers';

const bodyDisallowedMethods = ['get', 'options', 'head', 'trace', 'ws'];
export default (path, fn, config, { schema } = {}, ajv, method) => {
  // For easier aliasing
  const { validation, validationStringify } = prepareValidation(ajv, schema);

  const isSimpleRequest = isSimpleHandler(fn);

  const bodyCall = bodyDisallowedMethods.indexOf(method) === -1;

  return isSimpleRequest.simple
    ? isSimpleRequest.handler
    : async (res, req) => {
      // For future usage
      req.rawPath = path;
      req.method = method;

      const request =
          bodyCall && res.onData
            ? await http.request(req, res, bodyCall)
            : http.request(req, res);

      if (validationStringify) {
        let errors;
        for (let i = 0, len = validation.length; i < len; i++) {
          const { type, validator } = validation[i];

          const valid = validator(req[type]);

          if (!valid) {
            if (!errors) {
              errors = [
                { type, messages: validator.errors.map((err) => err.message) }
              ];
            } else {
              errors.push({
                type,
                messages: validator.errors.map((err) => err.message)
              });
            }
          }
        }

        if (errors && !res.aborted) {
          return res.end(validationStringify(errors));
        }
      }

      const response = http.response(
        res,
        req,
        config,
        schema && schema.response
      );

      if (!fn.async) {
        return fn(request, response, config);
      } else if (!bodyCall && !res.abortHandler) {
        // For async function requires onAborted handler
        res.onAborted(() => {
          if (res.readStream) {
            res.readStream.destroy();
          }
          res.aborted = true;
        });
        res.abortHandler = true;
      }

      if (res.aborted) {
        return undefined;
      }

      const result = await fn(request, response, config);

      if (res.aborted) {
        return undefined;
      }

      if (!result || result.error) {
        res.writeHeader('Content-Type', 'text/json');
        return res.end(
          '{"error":"' +
              (result && result.error
                ? result.message
                : 'The route you visited does not returned response') +
              '"}'
        );
      }
      if (!result.stream && method !== 'options') {
        if (typeof result === 'string' && !res.statusCode) {
          res.end(result);
        } else {
          res.send(result);
        }
      }
    };
};
