import mongoose from 'mongoose';
import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import { sendEmail } from '../services/notification.service.js';

export const createNotification = async (req, res) => {
  try {
    const { title, image, imageUrl, category } = req.body;
    const rawDescription = (req.body.description || req.body.message || req.body.content || '').trim();
    const rawTarget = req.body.assignedTo || req.body.recipientId || req.body.userId;

    if (!rawDescription) {
      return res.status(400).json({ success: false, message: 'Notification description is required.' });
    }

    if (!rawTarget) {
      return res.status(400).json({ success: false, message: 'Please select an assigned user.' });
    }

    const assignedTo = rawTarget;
    const description = rawDescription;

    const finalImageUrl = imageUrl || image || null;
    const finalCategory = (category && typeof category === 'string') ? category.toLowerCase().trim() : 'official';

    const currentUserId = req.user?.id || req.user?._id;
    let createdByName = req.user?.name || '';

    const validCreatorId = (currentUserId && mongoose.Types.ObjectId.isValid(String(currentUserId)))
      ? currentUserId
      : null;

    if (!createdByName && validCreatorId) {
      try {
        const creator = await User.findById(validCreatorId).select('name');
        if (creator) createdByName = creator.name;
      } catch (err) {
        console.warn("Could not fetch creator user name:", err);
      }
    }

    // Support single assignedTo ID or array of IDs
    const rawIds = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    const recipientIds = rawIds.filter(id => id && mongoose.Types.ObjectId.isValid(String(id)));

    if (recipientIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid assigned user ID provided.' });
    }

    const notificationsToCreate = recipientIds.map(userId => ({
      title: title && title.trim() ? title.trim() : 'Notification',
      description: description.trim(),
      image: finalImageUrl,
      imageUrl: finalImageUrl,
      category: finalCategory,
      assignedTo: userId,
      createdBy: validCreatorId,
      createdByName: createdByName || 'System',
      isRead: false
    }));

    const createdNotifications = await Notification.insertMany(notificationsToCreate);

    // Trigger Email Dispatch to all recipients
    try {
      const recipientUsers = await User.find({ _id: { $in: recipientIds } }).select('name email');
      const imageHtml = finalImageUrl ? `<div style="margin-top: 15px;"><img src="${finalImageUrl}" style="max-width: 100%; max-height: 300px; border-radius: 12px; border: 1px solid #e2e8f0;" alt="Notification Attachment" /></div>` : '';
      for (const u of recipientUsers) {
        if (u.email) {
          sendEmail(
            u.email,
            `🔔 ${title || 'New Notification'}`,
            `<p>Hello <strong>${u.name || 'Team Member'}</strong>,</p><div style="white-space: pre-wrap; font-family: inherit; line-height: 1.6;">${description.trim()}</div>${imageHtml}<p>- Sent via KOD.BRAND CRM HQ</p>`,
            description.trim()
          );
        }
      }
    } catch (mailErr) {
      console.error("Error triggering notification emails:", mailErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Notification sent successfully!',
      data: createdNotifications
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error creating notification.' });
  }
};

export const getMyNotifications = async (req, res) => {
  try {
    const currentUserId = req.user?.id || req.user?._id;

    if (!currentUserId || !mongoose.Types.ObjectId.isValid(String(currentUserId))) {
      return res.status(200).json({
        success: true,
        unreadCount: 0,
        data: []
      });
    }

    const notifications = await Notification.find({ assignedTo: currentUserId })
      .populate('createdBy', 'name email profile_image designation')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return res.status(200).json({
      success: true,
      unreadCount,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching my notifications:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error fetching notifications.' });
  }
};

export const getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find()
      .populate('assignedTo', 'name email employeeId designation department')
      .populate('createdBy', 'name email designation')
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching all notifications:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error fetching notifications.' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID.' });
    }

    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error updating notification.' });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const currentUserId = req.user?.id || req.user?._id;
    if (currentUserId && mongoose.Types.ObjectId.isValid(String(currentUserId))) {
      await Notification.updateMany(
        { assignedTo: currentUserId, isRead: false },
        { isRead: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error updating notifications.' });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID.' });
    }

    await Notification.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error deleting notification.' });
  }
};

export const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID.' });
    }

    const { title, description, category, image, imageUrl, assignedTo } = req.body;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    // Check authorization: creator or admin
    const currentUserId = req.user?.id || req.user?._id;
    const userRole = String(req.user?.role || req.user?.role_id || '').toLowerCase();
    const isAdmin = ['admin', '1', '2', 'superadmin', 'md'].includes(userRole);

    const isCreator = notification.createdBy && String(notification.createdBy) === String(currentUserId);

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only the creator or admin can update this notification.' });
    }

    if (title !== undefined) notification.title = title.trim();
    if (description !== undefined) notification.description = description.trim();
    if (category !== undefined) notification.category = category.toLowerCase().trim();

    const finalImage = imageUrl !== undefined ? imageUrl : image;
    if (finalImage !== undefined) {
      notification.image = finalImage;
      notification.imageUrl = finalImage;
    }

    if (assignedTo && mongoose.Types.ObjectId.isValid(String(assignedTo))) {
      notification.assignedTo = assignedTo;
    }

    await notification.save();

    return res.status(200).json({
      success: true,
      message: 'Notification updated successfully.',
      data: notification
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error updating notification.' });
  }
};
