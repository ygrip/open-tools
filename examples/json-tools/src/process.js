import { JSONPath } from 'jsonpath-plus';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';

export const MAX_INPUT_LENGTH = 1_000_000;
const xmlOptions = { ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', parseTagValue: false, parseAttributeValue: false, processEntities: true };

function inputText(input) {
  if (typeof input !== 'string') throw new Error('Paste some input first.');
  if (input.length > MAX_INPUT_LENGTH) throw new Error('Input exceeds the 1,000,000 character limit.');
  if (!input.trim()) throw new Error('Paste some input first.');
  return input;
}

function rejectUnsafeKeys(value) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error(`Unsupported object key: ${key}`);
    rejectUnsafeKeys(value[key]);
  }
}

export function parseJson(input) {
  try {
    return JSON.parse(inputText(input), (_key, value) => {
      if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
        throw new Error('Number exceeds safe JavaScript precision. Encode large integers as JSON strings.');
      }
      return value;
    });
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON: ${error.message}`);
    throw error;
  }
}

function assertXmlNames(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(assertXmlNames);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key !== '#text' && !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key.startsWith('@_') ? key.slice(2) : key)) {
      throw new Error(`Cannot represent JSON key "${key}" as an XML name.`);
    }
    assertXmlNames(child);
  }
}

export function transform(input, operation, query = '$') {
  if (operation === 'xml-to-json') {
    const xml = inputText(input);
    if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('DOCTYPE and ENTITY declarations are not supported.');
    const validation = XMLValidator.validate(xml);
    if (validation !== true) throw new Error(`Invalid XML at line ${validation.err.line}: ${validation.err.msg}`);
    // Explicit XML named entities plus numeric references; no custom/DTD entities.
    const result = new XMLParser({ ...xmlOptions, htmlEntities: { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } }).parse(xml);
    rejectUnsafeKeys(result);
    return JSON.stringify(result, null, 2);
  }

  const value = parseJson(input);
  if (operation === 'pretty') return JSON.stringify(value, null, 2);
  if (operation === 'query') {
    if (!query.trim()) throw new Error('Enter a JSONPath query, for example $.items[*].name.');
    if (query.length > 2048) throw new Error('JSONPath query exceeds the 2,048 character limit.');
    rejectUnsafeKeys(value);
    try {
      // jsonpath-plus returns undefined for falsy scalar roots; preserve root values.
      const matches = query.trim() === '$' ? [value] : JSONPath({ path: query, json: value, eval: false, wrap: true });
      return JSON.stringify(matches ?? [], null, 2);
    } catch (error) {
      throw new Error(`Invalid or unsupported JSONPath: ${error.message}`);
    }
  }
  if (operation === 'json-to-xml') {
    rejectUnsafeKeys(value);
    assertXmlNames(value);
    const document = new XMLBuilder({ ...xmlOptions, format: true, processEntities: true }).build({ root: value });
    const validation = XMLValidator.validate(document);
    if (validation !== true) throw new Error(`Cannot represent this value as XML: ${validation.err.msg}`);
    return document;
  }
  throw new Error(`Unknown operation: ${operation}`);
}
