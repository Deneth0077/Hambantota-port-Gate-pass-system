// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';

export async function parsePdf(buffer: Buffer) {
  try {
    const data = await pdf(buffer);
    const text = data.text;
    
    // ID Number (NIC/PP NO):
    const idMatch = text.match(/(?:NIC\/PP NO|ID Number|ID|ID No\.?|NIC|Passport|NIC No|EPF NO)\s*[:\-\.]?\s*([a-zA-Z0-9-]+)/i);
    
    // Name: Focused on 'NAME' or 'FULL NAME' as requested
    const nameMatch = text.match(/(?:\r?\n|^)\s*(?:NAME|FULL NAME)\s*[:\-\.]?\s*([a-zA-Z\s,.]+?)(?=\r?\n| {2,}|$|\n[A-Z\s]{4,}:)/i);
    
    // Designation: This can be multiple lines.
    const designationMatch = text.match(/(?:Designation|Position|Job Title|Role)\s*[:\-\.]?\s*([\s\S]+?)(?=\r?\nNAME:|\r?\nNIC\/PP NO:|\r?\nID:|\r?\n{2,}|$|\n[A-Z\s]{4,}:)/i);

    let designation = 'Unknown Designation';
    if (designationMatch) {
      designation = designationMatch[1].replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    }

    let name = nameMatch ? nameMatch[1].trim() : 'Unknown Name';
    // Clean up name (remove MR. MRS. Dr. etc if they are caught at start)
    name = name.replace(/^(?:MR\.|MRS\.|MS\.|DR\.|REV\.|PROF\.)\s+/i, '').trim();

    // Fallback for destination logic
    const destMatch = text.match(/(?:Destination|To|Location|Department)\s*[:\-\.]?\s*([a-zA-Z0-9\s,.]+?)(?=\r?\n| {2,}|$)/i);

    return {
      id: idMatch ? idMatch[1].trim() : 'Unknown ID',
      name: name,
      designation: designation,
      destination: destMatch ? destMatch[1].trim() : (designation !== 'Unknown Designation' ? designation : 'Unknown'),
      text: text 
    };
  } catch (error) {
    console.error('Error parsing individual PDF:', error);
    throw error;
  }
}
