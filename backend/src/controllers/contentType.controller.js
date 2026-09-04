import mongoose from 'mongoose';
import ContentType from '../models/contentType.model.js';

const DEFAULT_CONTENT_TYPES = [
  { name: 'Instagram Post', value: 'instagram_post', isSystemDefault: true },
  { name: 'Instagram Story', value: 'instagram_story', isSystemDefault: true },
  { name: 'Facebook Post', value: 'facebook_post', isSystemDefault: true },
  { name: 'Facebook Story', value: 'facebook_story', isSystemDefault: true },
  { name: 'Blog Post', value: 'blog_post', isSystemDefault: true },
  { name: 'YouTube Video', value: 'youtube_video', isSystemDefault: true },
  { name: 'Newsletter', value: 'newsletter', isSystemDefault: true },
  { name: 'Twitter/X Post', value: 'twitter_post', isSystemDefault: true },
  { name: 'TikTok Video', value: 'tiktok_video', isSystemDefault: true },
  { name: 'Email Campaign', value: 'email_campaign', isSystemDefault: true },
  { name: 'Web Banner', value: 'web_banner', isSystemDefault: true },
  { name: 'LinkedIn Post', value: 'linkedin_post', isSystemDefault: true },
  { name: 'Other', value: 'other', isSystemDefault: true }
];

/**
 * Get all content types (auto-seeds defaults if database is empty)
 * GET /api/v1/calendar-work/content-types
 */
export const getContentTypes = async (req, res) => {
  try {
    let types = await ContentType.find().sort({ name: 1 });

    // Seed defaults if empty
    if (!types || types.length === 0) {
      await ContentType.insertMany(DEFAULT_CONTENT_TYPES);
      types = await ContentType.find().sort({ name: 1 });
    }

    return res.status(200).json({
      success: true,
      message: 'Content types retrieved successfully',
      data: types
    });
  } catch (error) {
    console.error('Error fetching content types:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch content types'
    });
  }
};

/**
 * Create a new content type
 * POST /api/v1/calendar-work/content-types
 */
export const createContentType = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Content type name is required'
      });
    }

    const trimmedName = name.trim();

    // Check for duplicate name case-insensitively
    const existing = await ContentType.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Content type "${trimmedName}" already exists`
      });
    }

    const newType = await ContentType.create({
      name: trimmedName,
      description: description ? description.trim() : ''
    });

    return res.status(201).json({
      success: true,
      message: 'Content type created successfully',
      data: newType
    });
  } catch (error) {
    console.error('Error creating content type:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create content type'
    });
  }
};

/**
 * Update an existing content type
 * PUT /api/v1/calendar-work/content-types/:id
 */
export const updateContentType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const isValidId = mongoose.Types.ObjectId.isValid(id);
    let item = isValidId ? await ContentType.findById(id) : null;
    if (!item) {
      item = await ContentType.findOne({ value: id });
    }
    if (!item) {
      item = await ContentType.findOne({ name: { $regex: new RegExp(`^${id.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } });
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Content type not found'
      });
    }

    if (name && name.trim()) {
      const trimmedName = name.trim();
      const existing = await ContentType.findOne({
        _id: { $ne: item._id },
        name: { $regex: new RegExp(`^${trimmedName.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Content type "${trimmedName}" already exists`
        });
      }

      item.name = trimmedName;
    }

    if (description !== undefined) {
      item.description = description.trim();
    }

    await item.save();

    return res.status(200).json({
      success: true,
      message: 'Content type updated successfully',
      data: item
    });
  } catch (error) {
    console.error('Error updating content type:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update content type'
    });
  }
};

/**
 * Delete a content type
 * DELETE /api/v1/calendar-work/content-types/:id
 */
export const deleteContentType = async (req, res) => {
  try {
    const { id } = req.params;

    const isValidId = mongoose.Types.ObjectId.isValid(id);
    let item = isValidId ? await ContentType.findById(id) : null;
    if (!item) {
      item = await ContentType.findOne({ value: id });
    }
    if (!item) {
      item = await ContentType.findOne({ name: { $regex: new RegExp(`^${id.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } });
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Content type not found'
      });
    }

    await ContentType.findByIdAndDelete(item._id);

    return res.status(200).json({
      success: true,
      message: 'Content type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting content type:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete content type'
    });
  }
};
