# OCR Processing Troubleshooting Guide

## Current Issues

### 1. Button Event Handling
- OCR button triggers page navigation instead of OCR process
- Event propagation not properly stopped
- Need to ensure proper event handling in React components

### 2. Document Processing Gets Stuck
- OCR status shows as "processing" indefinitely
- No error messages in the console
- Process doesn't complete or fail gracefully

### 3. File Access Issues
- Potential problems with file paths in uploads directory
- Need to verify file existence before processing
- Permission issues might prevent reading uploaded files

### 4. Tesseract.js Integration
- Tesseract.js worker initialization might be failing silently
- Missing proper error handling and logging
- Configuration might need adjustment for proper worker setup

## Error Patterns

1. **Silent Failures**
   - OCR process starts but doesn't complete
   - No error messages in logs
   - Status remains "processing"

2. **File System Issues**
   - Files might not be accessible after upload
   - Path resolution problems between upload and processing
   - Need to verify file permissions and existence

3. **Event Handling Issues**
   - Button clicks not triggering the intended action
   - React event propagation issues
   - Form submission or navigation conflicts

## Debugging Steps

1. **Verify File Upload**
   ```javascript
   // Add this check after file upload
   if (!fs.existsSync(doc.fileUrl)) {
     log(`File not found: ${doc.fileUrl}`);
     // Handle error appropriately
   }
   ```

2. **Test Tesseract Worker**
   ```javascript
   // Test worker initialization
   const worker = await createWorker({
     logger: m => console.log('Tesseract:', m)
   });
   ```

3. **Add Detailed Logging**
   ```javascript
   // Add throughout the OCR process
   log(`Starting OCR for ${doc.id}`);
   log(`File path: ${doc.fileUrl}`);
   log(`File exists: ${fs.existsSync(doc.fileUrl)}`);
   ```

4. **Fix Event Handling**
   ```javascript
   const handleProcessOcr = (e: React.MouseEvent) => {
     e.preventDefault();
     e.stopPropagation();
     processOcrMutation.mutate();
   };
   ```

## Configuration Requirements

1. **Tesseract.js Setup**
   - Ensure proper worker initialization
   - Configure logger for debugging
   - Handle worker termination properly

2. **File System Access**
   - Verify upload directory permissions
   - Ensure proper file path handling
   - Check file existence before processing

3. **Error Handling**
   - Implement proper error states
   - Update UI to show detailed error messages
   - Add timeout handling for stuck processes

## Potential Solutions

1. **Implement Robust Error Handling**
   ```javascript
   try {
     // Initialize worker with logging
     const worker = await createWorker({
       logger: m => log(`Tesseract: ${JSON.stringify(m)}`),
     });

     // Verify file exists
     if (!fs.existsSync(filePath)) {
       throw new Error('File not found');
     }

     // Process with timeout
     const result = await Promise.race([
       worker.recognize(filePath),
       new Promise((_, reject) => 
         setTimeout(() => reject(new Error('OCR timeout')), 30000)
       )
     ]);

     await worker.terminate();
     return result;
   } catch (error) {
     log(`OCR Error: ${error.message}`);
     throw error;
   }
   ```

2. **Add Process Monitoring**
   - Implement status checks for long-running processes
   - Add timeout mechanism
   - Provide progress updates to UI

3. **File Processing Pipeline**
   - Validate file before processing
   - Convert images to appropriate format if needed
   - Implement retry mechanism for failed attempts

## Direct API Testing

1. **Test OCR Endpoint Directly**
   ```bash
   curl -X POST http://localhost:5000/api/documents/1/process-ocr \
     -H "Content-Type: application/json" \
     -H "Cookie: connect.sid=<your-session-cookie>" \
     -d '{}'
   ```

2. **Monitor Server Logs**
   Look for these specific log patterns:
   - File verification: "File exists: true/false"
   - Worker initialization: "Tesseract worker [id]: {status}"
   - Processing progress: "OCR completed, extracted X characters"
   - Error messages: "OCR Error: <specific error>"

## Known Limitations

1. Large files might cause memory issues
2. Processing time varies significantly by file size
3. Some file formats might not be properly supported
4. Network issues can affect worker initialization

## Immediate Action Items
1. Check if the uploaded files are actually accessible in the uploads directory
2. Verify Tesseract.js worker initialization with proper logging
3. Add proper error handling for the button click events
4. Implement timeouts for the OCR process
5. Add progress tracking in the UI

This document will be updated as new issues and solutions are discovered.