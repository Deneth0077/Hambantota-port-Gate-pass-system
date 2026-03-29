// @ts-ignore
const pdf = require('pdf-parse/lib/pdf-parse.js');


/**
 * Extracts specific fields from PDF text using regex.
 * User requirement: ID Number, Name, Destination.
 */
export async function parsePdf(buffer: Buffer) {
  try {
    const data = await pdf(buffer);
    const text = data.text;
    
    // We try to match variations of common PDF structures.
    // ID Number: Could be numeric or alphanumeric.
    const idMatch = text.match(/(?:ID Number|ID|ID No\.?)\s*:?\s*([a-zA-Z0-9-]+)/i);
    // Name: Usually alphabetical, might have spaces.
    const nameMatch = text.match(/(?:Name|Full Name)\s*:?\s*([a-zA-Z\s,.]+?)(?=\r?\n| {2,}|$)/i);
    // Destination: Where they're going.
    const destinationMatch = text.match(/(?:Destination|To|Location)\s*:?\s*([a-zA-Z0-9\s,.]+?)(?=\r?\n| {2,}|$)/i);

    return {
      id: idMatch ? idMatch[1].trim() : 'Unknown ID',
      name: nameMatch ? nameMatch[1].trim() : 'Unknown Name',
      destination: destinationMatch ? destinationMatch[1].trim() : 'Unknown Destination',
      text: text.substring(0, 500) // Keep snippet for debugging if needed
    };
  } catch (error) {
    console.error('Error parsing individual PDF:', error);
    throw error;
  }
}
