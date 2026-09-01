import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logoPath = path.join(__dirname, '../assets/logo3.png');

/**
 * Helper to check if a row is essentially empty (ignoring metadata fields)
 */
const isRowEmpty = (item) => {
  if (!item || typeof item !== 'object') return true;
  const skipKeys = new Set(['_id', 'id', '__v']);
  return !Object.entries(item).some(([k, v]) => {
    if (skipKeys.has(k)) return false;
    return v !== null && v !== undefined && String(v).trim() !== '';
  });
};

/**
 * Generates a beautiful PDF report from report data
 * @param {Object} report - Mongoose document or JS object containing report details
 * @param {String} empName - Name of the employee
 * @param {String} designation - Designation of the employee
 * @returns {Promise<Buffer>} Resolves with PDF file buffer
 */
export const generateReportPDFBuffer = (report, empName, designation) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true, bufferPages: true });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const primaryColor = '#3c2375'; // Purple
      const secondaryColor = '#84cc16'; // Lime/green
      const textColor = '#1e293b'; // Dark slate
      const labelColor = '#475569'; // Slate

      // --- PAGE HEADER FUNCTION ---
      const drawHeader = () => {
        // Draw logo3.png
        try {
          doc.image(logoPath, 40, 30, { height: 32 });
        } catch (err) {
          // Fallback branding text
          doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(22).text('KOD.', 40, 40, { continued: true });
          doc.fillColor(primaryColor).text('brand');
        }

        // Document title
        const periodStr = String(report?.report_period || report?.reportPeriod || (report?.isMonthly ? 'monthly' : '') || '').toLowerCase();
        const headerTitle = periodStr === 'monthly'
          ? 'MONTHLY CONSOLIDATED REPORT'
          : (periodStr === 'weekly' ? 'WEEKLY CONSOLIDATED REPORT' : 'DAILY SHIFT REPORT');

        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(13).text(headerTitle, 240, 40, { align: 'right' });
        
        doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.5).text((designation || 'Employee').toUpperCase(), 240, 58, { align: 'right' });

        // Horizontal line
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, 75).lineTo(555, 75).stroke();
        doc.y = 90;
      };

      drawHeader();

      // --- WIDOW PREVENTION HELPER ---
      const checkPageOverflow = (neededHeight) => {
        if (doc.y + neededHeight > 760) {
          doc.addPage();
          drawHeader();
        }
      };

      // --- SECTION HEADER DRAWING ---
      const drawSectionHeader = (title) => {
        checkPageOverflow(35);
        const startY = doc.y;
        doc.rect(40, startY, 515, 18).fill(primaryColor);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text(title.toUpperCase(), 48, startY + 5);
        doc.y = startY + 24;
      };

      // --- TABLE DRAWING HELPERS ---
      const drawKeyValueTable = (data, startX = 40) => {
        const keyWidth = 140;
        const valWidth = 375; // total = 515
        const rowHeight = 20;

        data.forEach(([key, val]) => {
          const isSignatureImage = String(key).toLowerCase().includes('signature') && String(val || '').startsWith('data:image/');
          const currentRowHeight = isSignatureImage ? 40 : rowHeight;

          checkPageOverflow(currentRowHeight + 4);
          const currentY = doc.y;

          // Key cell background
          doc.rect(startX, currentY, keyWidth, currentRowHeight).fill('#f8fafc');
          
          // Val cell background
          doc.rect(startX + keyWidth, currentY, valWidth, currentRowHeight).fill('#ffffff');

          // Borders
          doc.strokeColor('#e2e8f0').lineWidth(0.5)
             .rect(startX, currentY, keyWidth, currentRowHeight).stroke()
             .rect(startX + keyWidth, currentY, valWidth, currentRowHeight).stroke();

          // Key text
          doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8)
             .text(String(key), startX + 8, currentY + (currentRowHeight / 2) - 4, { width: keyWidth - 16, align: 'left', lineBreak: false });

          if (isSignatureImage) {
            try {
              const base64Data = val.replace(/^data:image\/\w+;base64,/, "");
              const imgBuffer = Buffer.from(base64Data, 'base64');
              doc.image(imgBuffer, startX + keyWidth + 8, currentY + 4, { height: currentRowHeight - 8 });
            } catch (err) {
              doc.fillColor(textColor).font('Helvetica').fontSize(8)
                 .text('[Invalid Signature Image]', startX + keyWidth + 8, currentY + (currentRowHeight / 2) - 4, { width: valWidth - 16, align: 'left', lineBreak: false });
            }
          } else {
            // Val text
            doc.fillColor(textColor).font('Helvetica').fontSize(8)
               .text(String(val || ''), startX + keyWidth + 8, currentY + (currentRowHeight / 2) - 4, { width: valWidth - 16, align: 'left', lineBreak: false });
          }

          doc.y = currentY + currentRowHeight;
        });

        doc.y += 10;
      };

      const drawTable = (headers, rows, columnWidths, startX = 40) => {
        const rowHeight = 22;
        const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

        // Check page overflow for table header
        checkPageOverflow(rowHeight * 2);

        let currentY = doc.y;

        // Draw header background
        doc.rect(startX, currentY, totalWidth, rowHeight).fill('#ffffff');

        // Draw header text and borders
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8);
        let currentX = startX;
        headers.forEach((header, index) => {
          // Draw border for header cell
          doc.strokeColor('#e2e8f0').lineWidth(0.5)
             .rect(currentX, currentY, columnWidths[index], rowHeight).stroke();

          doc.text(String(header || '').toUpperCase(), currentX + 6, currentY + 7, {
            width: columnWidths[index] - 12,
            align: 'left',
            lineBreak: false
          });
          currentX += columnWidths[index];
        });

        currentY += rowHeight;
        doc.y = currentY;

        // Draw rows
        rows.forEach((row) => {
          // Estimate required height for row based on text content
          let maxCellLines = 1;
          row.forEach((cellText, colIndex) => {
            const textWidth = columnWidths[colIndex] - 12;
            const textHeight = doc.heightOfString(String(cellText || ''), { width: textWidth });
            const cellLines = Math.ceil(textHeight / 11);
            if (cellLines > maxCellLines) maxCellLines = cellLines;
          });
          const currentRowHeight = Math.max(rowHeight, maxCellLines * 11 + 10);

          checkPageOverflow(currentRowHeight);
          currentY = doc.y;

          // Draw cells background, borders and text
          let colX = startX;
          row.forEach((cellText, colIndex) => {
            // Draw background cell rectangle
            doc.rect(colX, currentY, columnWidths[colIndex], currentRowHeight).fill('#ffffff');

            // Draw border
            doc.strokeColor('#e2e8f0').lineWidth(0.5)
               .rect(colX, currentY, columnWidths[colIndex], currentRowHeight)
               .stroke();

            // Draw cell text
            doc.fillColor(textColor).font('Helvetica').fontSize(7.5);
            doc.text(String(cellText || ''), colX + 6, currentY + 6, {
              width: columnWidths[colIndex] - 12,
              align: 'left'
            });
            colX += columnWidths[colIndex];
          });

          currentY += currentRowHeight;
          doc.y = currentY;
        });

        doc.y += 10;
      };

      // Excluded / Hidden Sections set from frontend user selection
      const excludedSectionsSet = new Set();
      const addExcludedKey = (rawKey) => {
        if (!rawKey) return;
        const k = String(rawKey).toLowerCase().trim();
        excludedSectionsSet.add(k);
        excludedSectionsSet.add(k.replace(/[^a-z0-9]/g, ''));
      };

      if (Array.isArray(report.excludedSections)) {
        report.excludedSections.forEach(s => addExcludedKey(s));
      }
      if (report.hiddenSections && typeof report.hiddenSections === 'object') {
        const hiddenObj = report.hiddenSections.toObject ? report.hiddenSections.toObject() : report.hiddenSections;
        Object.entries(hiddenObj).forEach(([k, v]) => {
          if (v === true) addExcludedKey(k);
        });
      }

      const isKeyExcluded = (keyName) => {
        if (!keyName) return false;
        const k = String(keyName).toLowerCase().trim();
        const kClean = k.replace(/[^a-z0-9]/g, '');
        if (excludedSectionsSet.has(k) || excludedSectionsSet.has(kClean)) return true;
        for (const ex of excludedSectionsSet) {
          if (ex && (k.includes(ex) || ex.includes(k) || kClean.includes(ex) || ex.includes(kClean))) {
            return true;
          }
        }
        return false;
      };

      // 1. BASIC DETAILS
      if (report.basicDetails && !isKeyExcluded('basicDetails') && !isKeyExcluded('basicdetails')) {
        const bd = report.basicDetails;
        const details = [
          ['Date', bd.date],
          ['Day', bd.day],
          ['Employee Name', bd.employeeName || empName],
          ['Employee ID', bd.employeeId],
          ['Department', bd.department],
          ['Designation', bd.designation || designation],
          ['Shift Timing', bd.shiftTiming],
          ['Reporting To', bd.reportingTo],
          ['Prepared Time', bd.preparedTime || bd.preparedAt]
        ].filter(([_, v]) => v && String(v).trim() !== '');

        if (details.length > 0) {
          drawSectionHeader('1. Basic Details');
          drawKeyValueTable(details);
        }
      }

      // 2. DAILY TASK SUMMARY / OPERATIONS
      const summaryKey = Object.keys(report).find(k => 
        k.toLowerCase().includes('tasksum') || 
        k.toLowerCase().includes('task_sum') || 
        k === 'dailyTaskSummary' || 
        k === 'dailyOperations'
      );

      if (summaryKey && !isKeyExcluded(summaryKey) && Array.isArray(report[summaryKey])) {
        // Filter out empty rows where nothing was written
        const filledSummaryRows = report[summaryKey].filter(t => !isRowEmpty(t));

        if (filledSummaryRows.length > 0) {
          drawSectionHeader('2. Daily Task Summary');
          
          const hasTaskDates = filledSummaryRows.some(t => t.startDate || t.endDate);
          const headers = hasTaskDates
            ? ['Activity', 'Due Date', 'Start Date', 'End Date', 'Status', 'Remarks']
            : ['Activity', 'Due Date', 'Status', 'Remarks'];
          const columnWidths = hasTaskDates
            ? [145, 60, 75, 75, 60, 100]
            : [195, 70, 90, 160]; // total 515
          const rows = filledSummaryRows.map(t => [
            t.activity || t.task || '',
            t.dueDate || '',
            ...(hasTaskDates ? [t.startDate || '', t.endDate || ''] : []),
            t.status || '',
            t.remarks || t.remark || ''
          ]);

          drawTable(headers, rows, columnWidths);
        }
      }

      // 3. OTHER DYNAMIC SECTIONS
      // Exclude metadata, nested approvals, and already printed sections
      const skipKeys = new Set([
        'basicDetails', summaryKey, '_id', '__v', 'userId', 'dateString', 'createdAt', 'updatedAt', 'approval', 'id', 'excludedSections', 'hiddenSections'
      ]);

      const reportObject = report.toObject ? report.toObject() : report;
      let sectionIndex = 3;

      for (const [key, val] of Object.entries(reportObject)) {
        if (skipKeys.has(key)) continue;
        if (isKeyExcluded(key)) continue;

        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
          // Filter out empty rows
          const filledRows = val.filter(item => !isRowEmpty(item));

          if (filledRows.length > 0) {
            let title = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
            if (key === 'salesActivity') title = 'Student Leads Update';
            if (key === 'clientSalesActivity') title = 'Client Leads Update';
            if (key === 'dailyOperations') title = 'Daily Operations Summary';
            if (key === 'performanceKpis') title = 'Performance KPI';
            if (key === 'issuesFeedback') title = 'Issues & Feedback';
            
            // For salesActivity and clientSalesActivity, explicitly preserve the standard schema columns including 'remarks'
            let activeKeys = [];
            if (key === 'salesActivity' || key === 'clientSalesActivity') {
              activeKeys = ['activity', 'count', 'digitalMktg', 'web', 'remarks'];
            } else if (key === 'dailyOperations') {
              activeKeys = ['activity', 'dueDate', 'startDate', 'endDate', 'status', 'remarks'];
            } else {
              const allKeys = [];
              filledRows.forEach(item => {
                Object.keys(item).forEach(k => {
                  if (k !== '_id' && k !== 'id' && !allKeys.includes(k)) {
                    allKeys.push(k);
                  }
                });
              });

              activeKeys = allKeys.filter(k => {
                if (k === '_id' || k === 'id' || k === '__v') return false;
                if (k === 'remarks' || k === 'remark' || k === 'statusRemarks') return true;
                return filledRows.some(item => {
                  const v = item[k];
                  return v !== null && v !== undefined && String(v).trim() !== '';
                });
              });
            }

            if (activeKeys.length > 0) {
              drawSectionHeader(`${sectionIndex}. ${title}`);
              
              // Custom key label map for clean headers
              const headerMap = {
                employeeName: 'Employee Name',
                countStatus: 'Count / Status',
                actionTaken: 'Action Taken',
                taskStatus: 'Task Status',
                dueDate: 'Due Date',
                startDate: 'Start Date',
                endDate: 'End Date',
                statusRemarks: 'Remarks',
                remarks: 'Remarks',
                remark: 'Remarks',
                digitalMktg: 'Digital Mktg',
                web: 'Web',
                count: 'Count',
                activity: 'Activity',
                hrAdminComments: 'HR Comments',
                incomes: 'Incomes',
                expense: 'Expense',
                transactionType: 'Transaction Type'
              };

              // Build headers
              const headers = activeKeys.map(k => headerMap[k] || k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' '));
              
              // Row data
              const rows = filledRows.map(item => activeKeys.map(k => item[k] || ''));

              // Custom column width distribution for sales activities
              let columnWidths;
              if (key === 'salesActivity' || key === 'clientSalesActivity') {
                columnWidths = [165, 55, 70, 70, 155];
              } else if (key === 'dailyOperations') {
                columnWidths = [140, 65, 65, 65, 60, 120];
              } else {
                columnWidths = activeKeys.map(() => Math.floor(515 / activeKeys.length));
                const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
                if (totalWidth < 515) {
                  columnWidths[columnWidths.length - 1] += (515 - totalWidth);
                }
              }

              drawTable(headers, rows, columnWidths);
              sectionIndex++;
            }
          }
        } else if (typeof val === 'string' && val.trim()) {
          // Standard text area field
          const title = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
          drawSectionHeader(`${sectionIndex}. ${title}`);
          
          // Draw as a single-column table card
          const rowHeight = doc.heightOfString(val, { width: 499 }) + 14;
          checkPageOverflow(rowHeight + 4);
          const currentY = doc.y;

          doc.rect(40, currentY, 515, rowHeight).fill('#ffffff');
          doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(40, currentY, 515, rowHeight).stroke();
          
          doc.fillColor(textColor).font('Helvetica').fontSize(8)
             .text(val, 48, currentY + 7, { width: 499, align: 'justify' });
             
          doc.y = currentY + rowHeight + 10;
          sectionIndex++;
        } else if (val && typeof val === 'object' && !Array.isArray(val)) {
          // Single nested tracking object (e.g. performanceTracker)
          const fields = [];
          Object.entries(val).forEach(([k, v]) => {
            if (k !== '_id' && k !== 'id') {
              const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
              let displayVal = v;
              if (v && typeof v === 'object') {
                displayVal = Object.entries(v)
                  .filter(([sk, sv]) => sk !== '_id' && sk !== 'id' && sv !== undefined && sv !== null && String(sv).trim() !== '')
                  .map(([sk, sv]) => `${sk.replace(/([A-Z])/g, ' $1').trim()}: ${sv}`)
                  .join(' | ');
              }
              if (displayVal !== undefined && displayVal !== null && String(displayVal).trim() !== '') {
                fields.push([label, displayVal]);
              }
            }
          });

          if (fields.length > 0) {
            const title = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
            drawSectionHeader(`${sectionIndex}. ${title}`);
            drawKeyValueTable(fields);
            sectionIndex++;
          }
        }
      }

      // 4. APPROVAL SIGNATURES
      if (report.approval) {
        const appObj = report.approval.toObject ? report.approval.toObject() : report.approval;
        const approvalDetails = Object.entries(appObj)
          .filter(([k, v]) => k !== '_id' && k !== 'id' && v !== null && v !== undefined && String(v).trim() !== '')
          .map(([k, v]) => [k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' '), v]);
        
        if (approvalDetails.length > 0) {
          drawSectionHeader('Approvals & Handover');
          drawKeyValueTable(approvalDetails);
        }
      }

      // --- PAGE FOOTER FUNCTION ---
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5);
        doc.text(
          `Page ${i + 1} of ${pages.count}  |  KOD.brand Command Center © ${new Date().getFullYear()}`,
          40,
          790,
          { align: 'center', width: 515 }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
