# GatePass Automator 🚀

A full-stack Next.js application designed to process hundreds of PDF files and categorize them automatically based on mappings found in an Excel spreadsheet.

## ✨ Features
- **Batch Processing**: Handles multiple (200+) PDF uploads simultaneously.
- **Smart Extraction**: Uses `pdf-parse` and regex to pull ID, Name, and Destination from PDF text.
- **Excel Mapping**: Matches extracted PDF destinations with Groups defined in an `.xlsx`/`.xls` file.
- **Dynamic Categorization**: Generates a ZIP file with folders for each Group.
- **Premium UI**: Dark-mode interface with glassmorphism, progress indicators, and detailed result snapshots.

## 🛠️ Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 4.0
- **PDF Parsing**: `pdf-parse`
- **Excel Handling**: `xlsx`
- **Packaging**: `jszip`
- **Icons**: `lucide-react`

## 📁 Project Structure
```text
lib/
  ├── pdf-parser.ts    # Logic for PDF text extraction & regex
  ├── excel-parser.ts  # Logic for Excel file reading (xlsx)
  └── matcher.ts       # Logic for matching PDFs to Groups
app/
  ├── api/process/     # Backend route for handling file processing
  ├── globals.css      # Tailwind & global styles
  ├── layout.tsx       # Root layout
  └── page.tsx         # Main UI for file uploads & results
```

## 🚀 How to Run

1. **Clone/Setup the Project**:
   Ensure you are in the project root directory.

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Prepare your files**:
   - **Excel**: Should have columns named "Destination" and "Group".
   - **PDFs**: Should contain keywords like "ID Number:", "Name:", "Destination:" followed by the values.

5. **Upload & Process**:
   - Navigate to `http://localhost:3000`.
   - Select all PDFs.
   - Select the Excel file.
   - Click "Categorize & Package".
   - Review results and download the ZIP.

## ⚠️ Notes
- Processing high volumes (200+ PDFs) may take a few seconds depending on your machine.
- Ensure the regex in `lib/pdf-parser.ts` matches your specific PDF format if extraction results show "Unknown".
- The body size limit for uploads is governed by your local Node.js environment or hosting provider.
