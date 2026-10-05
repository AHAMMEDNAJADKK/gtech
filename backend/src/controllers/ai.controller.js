import User from '../models/user.model.js';
import AcademicCounselorReport from '../models/academicCounselorReport.model.js';
import Lead from '../models/lead.model.js';
import StudentFee from '../models/studentFee.model.js';
import Course from '../models/course.model.js';
import { generateAIReport, generateAIChat } from '../services/ai.service.js';
import AiReportCache from '../models/aiReportCache.model.js';

export const getDailyReport = async (req, res) => {
  try {
    const { force, customNotes } = req.query;
    const isForce = force === 'true' || !!customNotes;

    // 1. Check Cache
    if (!isForce) {
      const cached = await AiReportCache.findOne({ type: 'daily', departmentId: 'all' });
      if (cached) {
        return res.status(200).json({
          success: true,
          report: cached.report,
          stats: cached.stats,
          cached: true
        });
      }
    }

    // 2. Aggregate EdTech Metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalLeads, todayLeads, counselorReports, totalFees] = await Promise.all([
      Lead.countDocuments({ isDeleted: false }),
      Lead.countDocuments({ isDeleted: false, createdAt: { $gte: today } }),
      AcademicCounselorReport.find({ date: { $gte: today } }).populate('userId', 'name').lean(),
      StudentFee.find().lean()
    ]);

    const feeCollected = totalFees.reduce((acc, f) => acc + (f.paidAmount || 0), 0);
    const feeDue = totalFees.reduce((acc, f) => acc + (f.pendingAmount || 0), 0);

    const edtechStats = {
      totalLeads,
      todayLeads,
      counselorReportsCount: counselorReports.length,
      feeCollected: `₹${feeCollected.toLocaleString('en-IN')}`,
      feeDue: `₹${feeDue.toLocaleString('en-IN')}`
    };

    let prompt = `You are an expert EdTech Admissions & Academic Operations Analyst.
Analyze the institute's daily admissions inquiries, counselor activity, and fee performance:
${JSON.stringify(edtechStats, null, 2)}

You MUST respond with a JSON object matching this schema:
{
  "summary": "A 1-sentence summary of today's admissions and academic operations",
  "teamVibe": "An emoji status of counselor activity (e.g. '🔥 High Enquiries', '⚡ Steady Follow-ups')",
  "employeeOfTheMonth": { "name": "N/A", "reason": "Daily report" },
  "markdownReport": "A structured Markdown report summarizing new admissions enquiries, counselor follow-ups, and collection milestones."
}`;

    if (customNotes) {
      prompt += `\n\nSpecific instructions: ${customNotes}`;
    }

    const reportRaw = await generateAIReport(prompt, null, true);

    let reportData;
    try {
      reportData = JSON.parse(reportRaw);
    } catch (e) {
      reportData = {
        summary: "Daily EdTech Admissions & Operations Report.",
        teamVibe: "⚡ Active",
        employeeOfTheMonth: { name: "N/A", reason: "" },
        markdownReport: reportRaw || "Daily Admissions and Academic Operations are running smoothly."
      };
    }

    const cachedStats = {
      summary: reportData.summary,
      teamVibe: reportData.teamVibe,
      employeeOfTheMonth: reportData.employeeOfTheMonth
    };

    await AiReportCache.findOneAndUpdate(
      { type: 'daily', departmentId: 'all' },
      {
        report: reportData.markdownReport,
        stats: cachedStats,
        lastGenerated: new Date()
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      report: reportData.markdownReport,
      stats: cachedStats
    });
  } catch (error) {
    console.error("Error generating daily AI report:", error);
    return res.status(500).json({ success: false, message: "Failed to generate report." });
  }
};

export const getMonthlyReport = async (req, res) => {
  try {
    const { force, customNotes } = req.query;
    const isForce = force === 'true' || !!customNotes;

    if (!isForce) {
      const cached = await AiReportCache.findOne({ type: 'monthly', departmentId: 'all' });
      if (cached) {
        return res.status(200).json({
          success: true,
          report: cached.report,
          stats: cached.stats,
          cached: true
        });
      }
    }

    const [leads, courses, fees] = await Promise.all([
      Lead.find({ isDeleted: false }).lean(),
      Course.find({ isActive: true }).lean(),
      StudentFee.find().lean()
    ]);

    const convertedLeads = leads.filter(l => l.status === 'Converted').length;
    const conversionRate = leads.length > 0 ? ((convertedLeads / leads.length) * 100).toFixed(1) + '%' : '0%';
    const totalCollected = fees.reduce((acc, f) => acc + (f.paidAmount || 0), 0);

    const monthlyStats = {
      totalInquiries: leads.length,
      convertedStudents: convertedLeads,
      conversionRate,
      activeCourses: courses.length,
      totalFeeCollected: `₹${totalCollected.toLocaleString('en-IN')}`
    };

    let prompt = `You are an executive EdTech Academic Director.
Summarize the monthly institute performance including lead-to-student conversions, active courses, and fee collections:
${JSON.stringify(monthlyStats, null, 2)}

You MUST respond with a JSON object matching this schema:
{
  "summary": "A 1-sentence executive summary of the month's EdTech growth",
  "teamVibe": "An emoji representing performance (e.g. '🚀 Excellent Admissions', '🎯 Target Met')",
  "employeeOfTheMonth": { "name": "Top Counselor", "reason": "Outstanding enrollment conversion" },
  "markdownReport": "A structured Markdown report evaluating inquiry trends, course popularity, and revenue collections."
}`;

    if (customNotes) {
      prompt += `\n\nSpecific instructions: ${customNotes}`;
    }

    const reportRaw = await generateAIReport(prompt, null, true);

    let reportData;
    try {
      reportData = JSON.parse(reportRaw);
    } catch (e) {
      reportData = {
        summary: "Monthly EdTech Performance Report.",
        teamVibe: "🚀 Growth",
        employeeOfTheMonth: { name: "N/A", reason: "" },
        markdownReport: reportRaw || "Monthly admissions and course completions are trending positively."
      };
    }

    const cachedStats = {
      summary: reportData.summary,
      teamVibe: reportData.teamVibe,
      employeeOfTheMonth: reportData.employeeOfTheMonth
    };

    await AiReportCache.findOneAndUpdate(
      { type: 'monthly', departmentId: 'all' },
      {
        report: reportData.markdownReport,
        stats: cachedStats,
        lastGenerated: new Date()
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      report: reportData.markdownReport,
      stats: cachedStats
    });
  } catch (error) {
    console.error("Error generating monthly AI report:", error);
    return res.status(500).json({ success: false, message: "Failed to generate report." });
  }
};

export const chatWithAi = async (req, res) => {
  try {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, message: "Messages array is required." });
    }

    const response = await generateAIChat(messages, context);
    return res.status(200).json({
      success: true,
      reply: response
    });
  } catch (error) {
    console.error("Error in AI Chat:", error);
    return res.status(500).json({ success: false, message: "Chat interaction failed." });
  }
};

export default {
  getDailyReport,
  getMonthlyReport,
  chatWithAi
};
