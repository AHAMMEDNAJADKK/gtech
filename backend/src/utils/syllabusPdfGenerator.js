import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logoPath = path.join(__dirname, '../assets/logo3.png');

/**
 * Generates an elegant, publication-quality multi-page PDF buffer
 * for a course syllabus using PDFKit.
 *
 * @param {Object} course - The Course Mongoose document or plain JS object
 * @returns {Promise<Buffer>} - Resolves with PDF file buffer
 */
export const generateSyllabusPdfBuffer = (course) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: `${course?.courseName || 'Course'} Syllabus`,
          Author: 'EdTech CRM Academy',
          Subject: 'Academic Course Syllabus and Curriculum Outline'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const primaryColor = '#312e81'; // Deep Indigo
      const accentColor = '#4f46e5';  // Vibrant Indigo
      const secondaryColor = '#0284c7'; // Sky
      const darkText = '#0f172a';    // Slate 900
      const bodyText = '#334155';    // Slate 700
      const mutedText = '#64748b';   // Slate 500
      const lightBg = '#f8fafc';     // Slate 50
      const borderColor = '#e2e8f0'; // Slate 200

      // --- PAGE HEADER FUNCTION ---
      const drawHeader = (isCover = false) => {
        // Logo / Brand name
        try {
          doc.image(logoPath, 40, 30, { height: 28 });
        } catch (_) {
          doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(16).text('EDTECH CRM', 40, 32, { continued: true });
          doc.fillColor(secondaryColor).text(' ACADEMY');
        }

        doc.fillColor(mutedText).font('Helvetica-Bold').fontSize(8)
          .text('OFFICIAL ACADEMIC CURRICULUM SPECIFICATION', 200, 36, { align: 'right', width: 355 });

        // Divider rule
        doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 68).lineTo(555, 68).stroke();
        doc.y = 80;
      };

      // Page overflow check helper
      const checkPageOverflow = (neededHeight) => {
        if (doc.y + neededHeight > 750) {
          doc.addPage();
          drawHeader(false);
        }
      };

      // Draw first page header
      drawHeader(true);

      // --- 1. COURSE HERO BANNER ---
      const bannerY = doc.y;
      doc.roundedRect(40, bannerY, 515, 95, 8).fill(primaryColor);

      // Category & Code Pill
      doc.fillColor('#c7d2fe').font('Helvetica-Bold').fontSize(8.5)
        .text(`${(course?.courseCode || 'CRS-2026').toUpperCase()}  •  ${(course?.category || 'Professional Bootcamp').toUpperCase()}  •  ${course?.durationValue || 6} ${course?.durationUnit || 'Months'}`, 55, bannerY + 14);

      // Course Title
      const courseTitle = String(course?.courseName || 'Course Syllabus').slice(0, 75);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17)
        .text(courseTitle, 55, bannerY + 30, { width: 485, lineGap: 2 });

      // Secondary summary line
      const modulesCount = Array.isArray(course?.syllabus) ? course.syllabus.length : 0;
      let totalTopics = 0;
      if (Array.isArray(course?.syllabus)) {
        course.syllabus.forEach(m => {
          if (Array.isArray(m.topics)) totalTopics += m.topics.length;
        });
      }

      doc.fillColor('#e0e7ff').font('Helvetica').fontSize(9)
        .text(`Curriculum Scope: ${modulesCount} Modules  •  ${totalTopics} Topics  •  Status: ${course?.status || 'ACTIVE'}`, 55, bannerY + 70);

      doc.y = bannerY + 110;

      // --- 2. COURSE OVERVIEW / DESCRIPTION ---
      const descText = course?.description || course?.shortDescription || 'This syllabus outlines the comprehensive technical curriculum, modular milestones, practical assignments, and learning objectives scheduled for this course.';
      
      checkPageOverflow(80);
      const descY = doc.y;
      doc.roundedRect(40, descY, 515, 60, 6).fill(lightBg).strokeColor(borderColor).lineWidth(1).stroke();

      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9)
        .text('COURSE OVERVIEW & OBJECTIVES', 52, descY + 10);

      doc.fillColor(bodyText).font('Helvetica').fontSize(8.5)
        .text(descText, 52, descY + 24, { width: 490, lineGap: 2, height: 32, ellipsis: true });

      doc.y = descY + 75;

      // --- 3. SYLLABUS MODULES & TOPICS ---
      checkPageOverflow(35);
      doc.fillColor(darkText).font('Helvetica-Bold').fontSize(12)
        .text('DETAILED MODULE BREAKDOWN', 40, doc.y);
      doc.strokeColor(accentColor).lineWidth(1.5).moveTo(40, doc.y + 4).lineTo(140, doc.y + 4).stroke();
      doc.y += 12;

      const modules = Array.isArray(course?.syllabus) && course.syllabus.length > 0
        ? course.syllabus
        : [];

      if (modules.length === 0) {
        checkPageOverflow(60);
        const emptyY = doc.y;
        doc.roundedRect(40, emptyY, 515, 45, 6).fill(lightBg).strokeColor(borderColor).lineWidth(1).stroke();
        doc.fillColor(mutedText).font('Helvetica').fontSize(9.5)
          .text('Curriculum modules are currently being revised and finalized by the academic committee.', 55, emptyY + 16, { width: 485 });
        doc.y = emptyY + 60;
      } else {
        modules.forEach((mod, modIdx) => {
          const modNumber = modIdx + 1;
          const modTitle = mod.title || `Module ${modNumber}`;
          const topics = Array.isArray(mod.topics) ? mod.topics : [];

          // Approximate height needed: header (30) + description (15) + topics (18 each)
          const neededHeight = 45 + (topics.length * 20);
          checkPageOverflow(Math.min(neededHeight, 90));

          // Module Header Bar
          const modStartY = doc.y;
          doc.roundedRect(40, modStartY, 515, 24, 4).fill('#eef2ff');
          
          // Number badge
          doc.roundedRect(44, modStartY + 3, 22, 18, 3).fill(primaryColor);
          doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5)
            .text(String(modNumber), 44, modStartY + 7, { width: 22, align: 'center' });

          // Title
          doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10)
            .text(modTitle.toUpperCase(), 74, modStartY + 7, { width: 380, ellipsis: true });

          // Topics badge count
          doc.fillColor(mutedText).font('Helvetica-Bold').fontSize(8)
            .text(`${topics.length} TOPICS`, 470, modStartY + 8, { width: 75, align: 'right' });

          doc.y = modStartY + 28;

          // Module Description if available
          if (mod.description && mod.description.trim()) {
            doc.fillColor(mutedText).font('Helvetica-Oblique').fontSize(8)
              .text(mod.description, 48, doc.y, { width: 500, lineGap: 1 });
            doc.y += 6;
          }

          // Render Topics
          if (topics.length === 0) {
            checkPageOverflow(18);
            doc.fillColor(mutedText).font('Helvetica').fontSize(8)
              .text('  • Comprehensive interactive workshops, labs, and code demonstrations.', 48, doc.y);
            doc.y += 14;
          } else {
            topics.forEach((topic, tIdx) => {
              checkPageOverflow(22);
              const topY = doc.y;
              
              // Bullet marker
              doc.circle(52, topY + 5, 2.5).fill(accentColor);

              // Topic Title
              doc.fillColor(darkText).font('Helvetica-Bold').fontSize(8.5)
                .text(`${tIdx + 1}.  ${topic.title || 'Curriculum Topic'}`, 62, topY, { width: 485 });

              doc.y += 12;

              // Topic description if available
              if (topic.description && topic.description.trim()) {
                doc.fillColor(bodyText).font('Helvetica').fontSize(8)
                  .text(topic.description, 72, doc.y, { width: 475, lineGap: 1 });
                doc.y += 10;
              }
            });
          }

          doc.y += 8;
        });
      }

      // --- 4. SIGN-OFF & CERTIFICATION WATERMARK ---
      checkPageOverflow(50);
      const signY = doc.y;
      doc.roundedRect(40, signY, 515, 38, 6).fill('#f1f5f9');
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(7.5)
        .text('ACADEMIC COUNCIL & EXAMINATION BOARD CERTIFIED CURRICULUM', 50, signY + 8);
      doc.fillColor(mutedText).font('Helvetica').fontSize(7)
        .text('This document constitutes the official syllabus prescribed by EdTech CRM Academy. Lesson sequences, live lectures, assignments, and evaluations adhere to the modular specifications detailed herein.', 50, signY + 18, { width: 495 });
      doc.y = signY + 48;

      // --- 5. NUMBER ALL BUFFERED PAGES ---
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);

        // Footer rule
        doc.strokeColor(borderColor).lineWidth(0.75).moveTo(40, 785).lineTo(555, 785).stroke();

        // Footer left: Course Code & Year
        doc.fillColor(mutedText).font('Helvetica').fontSize(7.5)
          .text(`EdTech CRM Academy • ${course?.courseCode || 'Curriculum'} • Academic Year 2026`, 40, 792);

        // Footer right: Page number
        doc.fillColor(mutedText).font('Helvetica-Bold').fontSize(7.5)
          .text(`Page ${i + 1} of ${range.count}`, 455, 792, { align: 'right', width: 100 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
