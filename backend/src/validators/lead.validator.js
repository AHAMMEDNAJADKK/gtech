import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const objectIdSchema = (fieldName) =>
  z.string().regex(objectIdRegex, { message: `Invalid format for ${fieldName}` });

export const createLeadSchema = z.object({
  leadName: z.string({ required_error: 'Lead name is required.' }).trim().min(1, 'Lead name is required.'),
  name: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  email: z.string().trim().email('Invalid email address.').optional().or(z.literal('')),
  phone: z.string({ required_error: 'Phone Number is required.' }).trim().min(1, 'Phone Number is required.'),
  city: z.string().trim().optional(),
  source: z.string().trim().optional(),
  interestedService: z.string().trim().optional(),
  campaignName: z.string().trim().optional(),
  leadPlatform: z.string().trim().optional(),
  assignedTo: objectIdSchema('assignedTo').nullable().optional().or(z.literal('')),
  status: z.enum(['New', 'Contacted', 'Follow Up', 'Interested', 'Converted', 'Lost']).optional().or(z.literal('')),
  priority: z.enum(['Low', 'Medium', 'High']).optional().or(z.literal('')),
  remarks: z.string().optional(),
  nextFollowUpDate: z.string().datetime({ offset: true }).optional().or(z.string().pipe(z.coerce.date())).optional().or(z.literal('')),
  clientMeetingFixed: z.string().trim().optional().or(z.literal('')),
  admissionYesNo: z.string().trim().optional().or(z.literal('')),
  leadsReceivedDate: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal('')),
  followUpDate1: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal('')),
  followUpDate2: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal('')),
  followUpDate3: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal('')),
  followUpDate4: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal('')),
  followUpDate5: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal(''))
});

export const updateLeadSchema = z.object({
  id: objectIdSchema('id').optional(),
  _id: objectIdSchema('_id').optional(),
  leadName: z.string().trim().min(1, 'Lead Name cannot be empty.').optional(),
  companyName: z.string().trim().optional(),
  email: z.string().trim().email('Invalid email address.').optional().or(z.literal('')),
  phone: z.string().trim().min(1, 'Phone Number cannot be empty.').optional(),
  city: z.string().trim().optional(),
  source: z.string().trim().optional(),
  interestedService: z.string().trim().optional(),
  campaignName: z.string().trim().optional(),
  leadPlatform: z.string().trim().optional(),
  assignedTo: objectIdSchema('assignedTo').nullable().optional().or(z.literal('')),
  status: z.enum(['New', 'Contacted', 'Follow Up', 'Interested', 'Converted', 'Lost']).optional().or(z.literal('')),
  priority: z.enum(['Low', 'Medium', 'High']).optional().or(z.literal('')),
  remarks: z.string().optional(),
  nextFollowUpDate: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal('')),
  lostReason: z.string().optional(),
  clientMeetingFixed: z.string().trim().optional().or(z.literal('')),
  admissionYesNo: z.string().trim().optional().or(z.literal('')),
  leadsReceivedDate: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal('')),
  followUpDate1: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal('')),
  followUpDate2: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal('')),
  followUpDate3: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal('')),
  followUpDate4: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal('')),
  followUpDate5: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal(''))
});

export const bulkUpdateStatusSchema = z.object({
  leadIds: z.array(objectIdSchema('leadId')).min(1, 'At least one lead ID is required.'),
  status: z.enum(['New', 'Contacted', 'Follow Up', 'Interested', 'Converted', 'Lost']),
  lostReason: z.string().optional()
});

export const addFollowUpSchema = z.object({
  leadId: objectIdSchema('leadId').optional(), // can be passed in param
  remarks: z.string().trim().min(1, 'Remarks are required.').optional(),
  nextFollowUpDate: z.string().pipe(z.coerce.date()).nullable().optional().or(z.literal('')),
  callSummary: z.string().trim().optional(),
  meetingNotes: z.string().trim().optional(),
  statusChangedTo: z.enum(['New', 'Contacted', 'Follow Up', 'Interested', 'Converted', 'Lost']).optional().or(z.literal(''))
});

export const updateStatusSchema = z.object({
  leadId: objectIdSchema('leadId').optional(),
  status: z.enum(['New', 'Contacted', 'Follow Up', 'Interested', 'Converted', 'Lost']),
  lostReason: z.string().optional()
});
