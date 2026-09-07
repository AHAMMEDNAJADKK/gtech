import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import Task from "../models/task.model.js";
import User from "../models/user.model.js";
import Project from "../models/project.model.js";
import Client from "../models/client.model.js"; // registers Client for populate('client')
import { AppError } from "../middleware/errorHandler.js";
import {
  sendTaskAssignmentEmail,
  sendTaskStatusUpdateEmail,
  sendNotification,
} from "../services/notification.service.js";

/* =========================================================
   CONSTANTS
========================================================= */

const VALID_STATUSES = [
  "pending",
  "current",
  "preview",
  "in-progress",
  "in_progress",
  "completed",
  "done",
  "cancelled",
  "on-hold",
  "on_hold",
  "review",
  "under-review",
  "under_review",
  "testing",
];

const VALID_PRIORITIES = ["low", "medium", "high"];

/* =========================================================
   HELPERS
========================================================= */

const parseDueDate = (dateVal) => {
  if (!dateVal) return undefined;
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed) return undefined;
    // If sent as raw datetime-local string without timezone offset e.g. "2026-09-04T12:22" or "2026-09-04T12:22:00"
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const [datePart, timePart] = trimmed.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute, second] = timePart.split(':').map(Number);
      return new Date(year, month - 1, day, hour, minute, second || 0);
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? undefined : d;
};

const getAuthUserId = (req) => {
  return req.user?.id || req.user?._id || req.user?.userId;
};

const isObjectIdLike = (value) => {
  if (!value || typeof value !== "object") return false;

  return (
    value instanceof mongoose.Types.ObjectId ||
    value._bsontype === "ObjectId" ||
    value._bsontype === "ObjectID" ||
    value.constructor?.name === "ObjectId"
  );
};

const normalizeId = (value) => {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "object") {
    if (isObjectIdLike(value)) {
      return value.toString();
    }

    const nested = value._id || value.id;
    if (nested && nested !== value) {
      return normalizeId(nested);
    }

    if (typeof value.toString === "function") {
      const asString = value.toString();
      if (asString && asString !== "[object Object]") return asString;
    }

    return null;
  }

  return String(value);
};

const isValidObjectId = (value) => {
  const id = String(value || "").trim();
  return /^[a-fA-F0-9]{24}$/.test(id);
};

const getUserRole = (req) => {
  return String(req.user?.role || "")
    .toLowerCase()
    .trim();
};

const getRoleId = (req) => {
  return String(req.user?.role_id || req.user?.roleId || "").trim();
};

const isSuperAdminUser = (req) => {
  const role = getUserRole(req);
  const roleId = getRoleId(req);

  return (
    req.user?.isSuperAdmin === true ||
    req.user?.is_super_admin === true ||
    role === "superadmin" ||
    role === "super_admin" ||
    roleId === "0"
  );
};

const getUserName = (req) => {
  return (
    req.user?.name || req.user?.fullName || req.user?.username || "Team Member"
  );
};

/* =========================================================
   ROLE / PERMISSION HELPERS
========================================================= */

const getCurrentUserDetails = async (req) => {
  const userId = getAuthUserId(req);

  if (!userId || !isValidObjectId(userId)) {
    throw new AppError("Authenticated user not found", 401);
  }

  const user = await User.findById(userId)
    .populate("departmentId", "name")
    .populate("designationId", "name")
    .lean();

  return user;
};

const getUserPermissionContext = async (req) => {
  const userId = getAuthUserId(req);

  const user = await getCurrentUserDetails(req);

  const roleName = String(req.user?.role || user?.role || "")
    .toLowerCase()
    .trim();

  const roleId = String(
    req.user?.role_id ||
      req.user?.roleId ||
      user?.role_id ||
      user?.roleId ||
      "",
  ).trim();

  const departmentName = String(
    req.user?.department || user?.department || user?.departmentId?.name || "",
  )
    .toLowerCase()
    .trim();

  const departmentId = normalizeId(
    req.user?.departmentId || req.user?.department_id || user?.departmentId,
  );

  const designationName = String(
    req.user?.designation ||
      user?.designation ||
      user?.designationId?.name ||
      "",
  )
    .toLowerCase()
    .trim();

  const isSuperAdmin =
    isSuperAdminUser(req) ||
    roleName === "superadmin" ||
    roleName === "super_admin" ||
    roleId === "0";

  const isHrOrAdminDepartment =
    departmentName.includes("hr") ||
    departmentName.includes("human resource") ||
    departmentName.includes("admin") ||
    departmentName.includes("management");

  const executiveTitles = [
    "md",
    "managing director",
    "ceo",
    "chief executive officer",
    "coo",
    "chief operating officer",
    "director",
    "executive director",
  ];

  const isExecutive = executiveTitles.some(
    (title) =>
      designationName === title ||
      designationName.includes(title) ||
      roleName === title ||
      roleName.includes(title),
  );

  const isManagerOrLead =
    roleName.includes("manager") ||
    roleName.includes("lead") ||
    roleName.includes("hod") ||
    designationName.includes("manager") ||
    designationName.includes("lead") ||
    designationName.includes("hod") ||
    roleId === "2";

  return {
    user,
    userId,
    roleName,
    roleId,
    departmentName,
    departmentId,
    designationName,
    isSuperAdmin,
    isHrOrAdminDepartment,
    isExecutive,
    isManagerOrLead,
    isAdminOrHr: isSuperAdmin || isHrOrAdminDepartment || isExecutive,
  };
};

/* =========================================================
   LOCAL FILE STORAGE
========================================================= */

const getLocalUploadRoot = () =>
  path.resolve(process.cwd(), "uploads", "tasks");

const getRelativeUploadUrl = (absoluteFilePath) => {
  const relativePath = path
    .relative(process.cwd(), absoluteFilePath)
    .replace(/\\/g, "/");

  return `/${relativePath}`;
};

const deleteLocalAttachmentFile = async (attachment) => {
  if (!attachment) return;

  let candidatePath = attachment.path;

  if (!candidatePath && attachment.url) {
    try {
      const url = new URL(attachment.url, "http://localhost");
      if (url.pathname.startsWith("/uploads/")) {
        candidatePath = url.pathname.replace(/^\//, "");
      }
    } catch {
      candidatePath = String(attachment.url || "")
        .replace(/^\//, "")
        .trim();
    }
  }

  if (!candidatePath) return;

  const absolutePath = path.resolve(process.cwd(), candidatePath);

  try {
    await fs.access(absolutePath);
    await fs.unlink(absolutePath);
  } catch {
    // Ignore missing or already removed local files.
  }
};

const processUploadedFiles = async (files, taskId) => {
  const attachments = [];

  if (!Array.isArray(files) || files.length === 0) {
    return attachments;
  }

  for (const file of files) {
    if (!file?.path) continue;

    const isImage =
      file.mimetype?.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif|heic|jfif)$/i.test(
        file.originalname || "",
      );

    const relativePath = path
      .relative(process.cwd(), file.path)
      .replace(/\\/g, "/");

    attachments.push({
      url: `/${relativePath}`,
      path: relativePath,
      name: file.originalname || "Attachment",
      public_id: `${taskId || "task"}-${Date.now()}-${file.filename || "attachment"}`,
      fileType: isImage ? "image" : "file",
      size: Number(file.size) || 0,
    });
  }

  return attachments;
};

/* =========================================================
   PARSING HELPERS
========================================================= */

const parseArrayInput = (value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const parseAssigneeIds = (value) => {
  const parsed = parseArrayInput(value);

  return parsed
    .map((item) => {
      if (typeof item === "object" && item !== null) {
        return normalizeId(item);
      }

      return String(item || "").trim();
    })
    .filter((id) => id && isValidObjectId(id));
};

const parseLinks = (value) => {
  const links = parseArrayInput(value);

  return links
    .filter(Boolean)
    .map((link) => {
      if (typeof link === "string") {
        return {
          url: link.trim(),
          title: link.trim(),
        };
      }

      return {
        ...link,
        url: String(link.url || "").trim(),
        title: String(link.title || link.name || link.url || "").trim(),
      };
    })
    .filter((link) => link.url);
};

const parseSubtasks = (value, userId) => {
  const parsed = parseArrayInput(value);

  return parsed
    .map((st) => {
      if (typeof st === "string") {
        return {
          title: st.trim(),
          completed: false,
          created_by: userId,
          completed_by: null,
        };
      }

      return {
        title: String(st?.title || "").trim(),
        completed: Boolean(st?.completed),
        created_by: normalizeId(st?.created_by) || userId,
        completed_by: st?.completed
          ? normalizeId(st?.completed_by) || userId
          : null,
      };
    })
    .filter((st) => st.title);
};

/* =========================================================
   FORMAT TASK
========================================================= */

const formatUserRef = (user) => {
  if (!user) return null;

  if (typeof user !== "object" || isObjectIdLike(user)) {
    return normalizeId(user);
  }

  const id = normalizeId(user._id || user.id);
  return {
    id,
    _id: id,
    name: user.name || "",
    email: user.email || "",
  };
};

const formatEntityRef = (entity, extraFields = []) => {
  if (!entity) return null;

  if (typeof entity !== "object" || isObjectIdLike(entity)) {
    return normalizeId(entity);
  }

  const id = normalizeId(entity._id || entity.id);
  const formatted = { id, _id: id };

  extraFields.forEach((field) => {
    if (entity[field] !== undefined) formatted[field] = entity[field];
  });

  return formatted;
};

const formatLeanTask = (task) => {
  if (!task) return null;

  const id = normalizeId(task._id || task.id);
  const assigneeSource = Array.isArray(task.assigned_to)
    ? task.assigned_to.filter(Boolean)
    : task.assigned_to
      ? [task.assigned_to]
      : [];

  const formatted = {
    id,
    title: task.title,
    description: task.description || "",
    status: task.status,
    priority: task.priority,
    designation_id: task.designation_id,
    dueDate: task.dueDate || null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    user_id: normalizeId(task.created_by || task.user_id),
    assigned_to: assigneeSource.map((user) => formatUserRef(user)).filter(Boolean),
    created_by: formatUserRef(task.created_by) || normalizeId(task.created_by),
    file: task.file_url || task.file || null,
    image: task.file_url || task.image || null,
    file_url: task.file_url || null,
    attachments: Array.isArray(task.attachments)
      ? task.attachments.filter(Boolean)
      : task.file_url
        ? [
            {
              url: task.file_url,
              name: "Attachment",
              public_id: task.file_public_id || null,
              fileType: "file",
            },
          ]
        : [],
    comments: Array.isArray(task.comments)
      ? task.comments.filter(Boolean).map((comment) => {
          const authorRef = comment.author || comment.user || comment.user_id || comment.created_by;
          return {
            id: normalizeId(comment._id || comment.id),
            author: formatUserRef(authorRef) || normalizeId(authorRef),
            comment: comment.comment || comment.text || "",
            text: comment.text || comment.comment || "",
            attachments: Array.isArray(comment.attachments) ? comment.attachments : [],
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
          };
        })
      : [],
    links: Array.isArray(task.links) ? task.links.filter(Boolean) : [],
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.filter(Boolean).map((st) => ({
          title: st.title,
          completed: Boolean(st.completed),
          createdAt: st.createdAt,
          id: normalizeId(st._id || st.id),
          created_by: formatUserRef(st.created_by) || st.created_by || null,
          completed_by: formatUserRef(st.completed_by) || st.completed_by || null,
        }))
      : [],
    client_id: normalizeId(task.client),
    project_id: normalizeId(task.project),
    client: formatEntityRef(task.client, [
      "companyName",
      "clientName",
      "clientId",
    ]),
    project: formatEntityRef(task.project, [
      "projectName",
      "projectCode",
      "status",
    ]),
  };

  return formatted;
};

const TASK_POPULATE = [
  { path: "assigned_to", select: "name email", strictPopulate: false },
  { path: "created_by", select: "name email", strictPopulate: false },
  { path: "comments.author", select: "name email", strictPopulate: false },
  { path: "comments.user", select: "name email", strictPopulate: false },
  { path: "subtasks.created_by", select: "name email", strictPopulate: false },
  { path: "subtasks.completed_by", select: "name email", strictPopulate: false },
  {
    path: "client",
    select: "companyName clientName clientId",
    strictPopulate: false,
  },
  {
    path: "project",
    select: "projectName projectCode status",
    strictPopulate: false,
  },
];

const applyTaskPopulates = (query) => {
  TASK_POPULATE.forEach((spec) => {
    query.populate(spec);
  });
  return query;
};

const formatTaskList = (tasks) => {
  if (!Array.isArray(tasks)) return [];

  const formatted = [];

  for (const task of tasks) {
    try {
      const safeTask = formatLeanTask(task);
      if (safeTask) formatted.push(safeTask);
    } catch (formatError) {
      console.error(
        "Skipping unreadable task during format:",
        task?._id || task?.id,
        formatError.message,
      );
    }
  }

  return formatted;
};

const findTasksSafe = async (filter) => {
  const query = filter && typeof filter === "object" ? filter : {};

  try {
    return await applyTaskPopulates(Task.find(query))
      .select("-file_public_id")
      .sort({ createdAt: -1 })
      .lean();
  } catch (populateError) {
    console.error(
      "Task populate failed, retrying without populate:",
      populateError.message,
    );
  }

  try {
    return await Task.find(query)
      .select("-file_public_id")
      .sort({ createdAt: -1 })
      .lean();
  } catch (findError) {
    console.error(
      "Mongoose Task.find failed, falling back to raw collection:",
      findError.message,
    );
  }

  return Task.collection.find(query).sort({ createdAt: -1 }).toArray();
};

/* =========================================================
   POPULATE TASK
========================================================= */

const getPopulatedTask = async (taskId) => {
  try {
    return await applyTaskPopulates(Task.findById(taskId)).lean();
  } catch (populateError) {
    console.error(
      "getPopulatedTask populate failed, returning lean document:",
      populateError.message,
    );
    return Task.findById(taskId).lean();
  }
};

/* =========================================================
   PROJECT PROGRESS
========================================================= */

export const syncProjectProgress = async (projectId) => {
  if (!projectId) return;

  try {
    const projectIdString = normalizeId(projectId);

    if (!projectIdString) return;

    if (!isValidObjectId(projectIdString)) {
      return;
    }

    const totalTasks = await Task.countDocuments({
      project: projectIdString,
    });

    if (totalTasks === 0) {
      await Project.findByIdAndUpdate(projectIdString, {
        $set: {
          progress: 0,
        },
      });

      return;
    }

    const completedTasks = await Task.countDocuments({
      project: projectIdString,
      status: {
        $in: ["completed", "done", "Completed", "Done", "DONE"],
      },
    });

    const progress = Math.round((completedTasks / totalTasks) * 100);

    await Project.findByIdAndUpdate(projectIdString, {
      $set: {
        progress,
      },
    });
  } catch (error) {
    console.error("Failed to sync project progress:", error.message);
  }
};

/* =========================================================
   CREATE TASK
   POST /api/v1/tasks/create
========================================================= */

export const createTask = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const {
      title,
      description,
      assigned_to,
      designation_id,
      dueDate,
      client,
      project,
      priority,
      status,
    } = req.body;

    if (!title?.trim()) {
      throw new AppError("Task title is required", 400);
    }

    const assigneeIds = parseAssigneeIds(assigned_to);

    if (assigneeIds.length === 0) {
      throw new AppError("At least one assigned user is required", 400);
    }

    /* Verify assignees exist */

    const assigneeCount = await User.countDocuments({
      _id: {
        $in: assigneeIds,
      },
    });

    if (assigneeCount !== assigneeIds.length) {
      throw new AppError("One or more assigned users do not exist", 400);
    }

    /* Files */

    const filesList = Array.isArray(req.files)
      ? req.files
      : req.file
        ? [req.file]
        : [];

    const attachments = await processUploadedFiles(filesList);

    const fileUrl = attachments[0]?.url || null;

    const filePublicId = attachments[0]?.public_id || null;

    /* Links */

    const links = parseLinks(req.body.links);

    /* Subtasks */

    const subtasks = parseSubtasks(req.body.subtasks, userId);

    /* Client */

    const clientId =
      client && isValidObjectId(client)
        ? new mongoose.Types.ObjectId(client)
        : null;

    /* Project */

    const projectId =
      project && isValidObjectId(project)
        ? new mongoose.Types.ObjectId(project)
        : null;

    /* Status */

    const normalizedStatus =
      status && VALID_STATUSES.includes(String(status).toLowerCase())
        ? String(status).toLowerCase()
        : "pending";

    /* Priority */

    const normalizedPriority =
      priority && VALID_PRIORITIES.includes(String(priority).toLowerCase())
        ? String(priority).toLowerCase()
        : "medium";

    const task = new Task({
      title: title.trim(),

      description: description?.trim() || "",

      assigned_to: assigneeIds,

      designation_id: designation_id || undefined,

      dueDate: parseDueDate(dueDate),

      client: clientId,

      project: projectId,

      status: normalizedStatus,

      priority: normalizedPriority,

      created_by: userId,

      user_id: userId,

      attachments,

      links,

      subtasks,

      file_url: fileUrl,

      file_public_id: filePublicId,

      image: fileUrl,
    });

    await task.save();

    if (projectId) {
      await syncProjectProgress(projectId);
    }

    const populatedTask = await getPopulatedTask(task._id);

    /* Notifications */

    try {
      const assignees = Array.isArray(populatedTask?.assigned_to)
        ? populatedTask.assigned_to
        : [];

      const creatorName = populatedTask?.created_by?.name || getUserName(req);

      for (const assignee of assignees) {
        const assigneeId = normalizeId(assignee);

        if (!assigneeId) continue;

        await sendNotification(
          assigneeId,
          `You have been assigned a new task: "${task.title}". Due date: ${
            dueDate ? new Date(dueDate).toLocaleDateString() : "No deadline"
          }`,
          "task_assigned",
          `New Task Assigned: ${task.title}`,
          userId,
          creatorName,
        );

        if (assignee.email) {
          await sendTaskAssignmentEmail({
            recipientEmail: assignee.email,

            recipientName: assignee.name || "Team Member",

            taskTitle: task.title,

            taskDescription: task.description,

            dueDate: task.dueDate,

            creatorName,
          });
        }
      }
    } catch (notificationError) {
      console.error(
        "Task assignment notification failed:",
        notificationError.message,
      );
    }

    return res.status(201).json({
      success: true,
      task: formatLeanTask(populatedTask),
    });
  } catch (error) {
    console.error("CREATE TASK ERROR:", error);

    next(error);
  }
};

/* =========================================================
   GET ALL TASKS
   GET /api/v1/tasks/all
========================================================= */

export const getAllTasks = async (req, res, next) => {
  try {
    const context = await getUserPermissionContext(req);

    const { userId, isAdminOrHr, isManagerOrLead } = context;

    const targetUserId =
      req.query.user_id || req.query.userId || req.query.targetUserId;

    let query = {};

    /* Specific user filter */

    if (targetUserId) {
      if (!isValidObjectId(targetUserId)) {
        throw new AppError("Invalid user ID", 400);
      }

      /*
       * Admin/manager can inspect another user's
       * tasks. Normal users can only request
       * their own tasks.
       */

      if (
        !isAdminOrHr &&
        !isManagerOrLead &&
        String(targetUserId) !== String(userId)
      ) {
        throw new AppError(
          "Forbidden: You cannot view another user tasks",
          403,
        );
      }

      const targetObjId = new mongoose.Types.ObjectId(targetUserId);
      const userMatches = [String(targetUserId), targetObjId];

      query = {
        $or: [
          {
            created_by: { $in: userMatches },
          },
          {
            assigned_to: { $in: userMatches },
          },
          {
            user_id: { $in: userMatches },
          },
        ],
      };
    } else if (isAdminOrHr) {
      /* Admin / HR / Executive */
      query = {};
    } else if (isManagerOrLead) {
      /* Manager / Team Lead */
      const Department = (
        await import("../modules/departments/department.model.js")
      ).default;

      const ledDepartments = await Department.find({
        managerId: userId,
      }).select("_id");

      const departmentIds = ledDepartments.map((department) => department._id);

      const currentUser = await User.findById(userId)
        .select("departmentId department")
        .lean();

      if (departmentIds.length === 0 && currentUser?.departmentId) {
        departmentIds.push(currentUser.departmentId);
      }

      const usersInDepartment =
        departmentIds.length > 0
          ? await User.find({
              $or: [
                {
                  departmentId: {
                    $in: departmentIds,
                  },
                },
              ],
            }).select("_id")
          : [];

      const teamUserIds = usersInDepartment.map((user) => user._id);
      teamUserIds.push(userId);

      const expandedTeamIds = [];
      for (const id of teamUserIds) {
        const str = String(id);
        expandedTeamIds.push(str);
        if (isValidObjectId(str)) {
          expandedTeamIds.push(new mongoose.Types.ObjectId(str));
        }
      }

      const userObjId = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null;
      const userMatches = userObjId ? [String(userId), userObjId] : [String(userId)];

      query = {
        $or: [
          {
            assigned_to: {
              $in: expandedTeamIds,
            },
          },
          {
            created_by: {
              $in: userMatches,
            },
          },
          {
            user_id: {
              $in: userMatches,
            },
          },
        ],
      };
    } else {
      /* Normal user */
      const userObjId = isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null;
      const userMatches = userObjId ? [String(userId), userObjId] : [String(userId)];

      query = {
        $or: [
          {
            assigned_to: {
              $in: userMatches,
            },
          },
          {
            created_by: {
              $in: userMatches,
            },
          },
          {
            user_id: {
              $in: userMatches,
            },
          },
        ],
      };
    }

    const tasks = await findTasksSafe(query);

    return res.status(200).json(formatTaskList(tasks));
  } catch (error) {
    console.error("GET ALL TASKS ERROR:", error);
    next(error);
  }
};

/* =========================================================
   GET USER TASKS
   GET /api/v1/tasks/user/tasks?user_id=...
========================================================= */

export const getUserTasks = async (req, res, next) => {
  try {
    const { userId, isAdminOrHr, isManagerOrLead } =
      await getUserPermissionContext(req);

    const { user_id } = req.query;

    if (!user_id) {
      throw new AppError("user_id is required", 400);
    }

    if (!isValidObjectId(user_id)) {
      throw new AppError("Invalid user ID", 400);
    }

    if (
      !isAdminOrHr &&
      !isManagerOrLead &&
      String(user_id) !== String(userId)
    ) {
      throw new AppError("Access denied. Insufficient permissions.", 403);
    }

    const targetObjId = new mongoose.Types.ObjectId(user_id);
    const userMatches = [String(user_id), targetObjId];

    const tasks = await findTasksSafe({
      $or: [
        { assigned_to: { $in: userMatches } },
        { user_id: { $in: userMatches } },
        { created_by: { $in: userMatches } },
      ],
    });

    return res.status(200).json(formatTaskList(tasks));
  } catch (error) {
    console.error("GET USER TASKS ERROR:", error);
    next(error);
  }
};

/* =========================================================
   CURRENT USER TASKS
   GET /api/v1/tasks/current-user/tasks
========================================================= */

export const getCurrentUserTasks = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId || !isValidObjectId(userId)) {
      throw new AppError("Authentication required", 401);
    }

    const userObjId = new mongoose.Types.ObjectId(userId);
    const userMatches = [String(userId), userObjId];

    const tasks = await findTasksSafe({
      $or: [
        {
          assigned_to: {
            $in: userMatches,
          },
        },
        {
          created_by: {
            $in: userMatches,
          },
        },
        {
          user_id: {
            $in: userMatches,
          },
        },
      ],
    });

    return res.status(200).json(formatTaskList(tasks));
  } catch (error) {
    console.error("GET CURRENT USER TASKS ERROR:", error);
    next(error);
  }
};

/* =========================================================
   DELETE TASK
   DELETE /api/v1/tasks/delete/:task_id
========================================================= */

export const deleteTask = async (req, res, next) => {
  try {
    const { task_id } = req.params;

    if (!isValidObjectId(task_id)) {
      throw new AppError("Invalid task ID", 400);
    }

    const task = await Task.findById(task_id);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const userId = getAuthUserId(req);

    const isCreator = normalizeId(task.created_by || task.user_id) === String(userId);

    const isSuperAdmin = isSuperAdminUser(req);

    if (!isCreator && !isSuperAdmin) {
      throw new AppError(
        "Forbidden: Only the task creator or SuperAdmin can delete this task",
        403,
      );
    }

    const projectId = task.project;

    /* Delete all local task attachments */
    if (Array.isArray(task.attachments)) {
      for (const attachment of task.attachments) {
        await deleteLocalAttachmentFile(attachment);
      }
    }

    if (
      task.file_public_id &&
      !task.attachments?.some(
        (attachment) => attachment.public_id === task.file_public_id,
      )
    ) {
      await deleteLocalAttachmentFile({
        path: task.file_url || "",
        url: task.file_url || "",
      });
    }

    await task.deleteOne();

    if (projectId) {
      await syncProjectProgress(projectId);
    }

    return res.status(200).json({
      success: true,
      message: "Task and associated resources deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   UPDATE TASK STATUS
   PUT /api/v1/tasks/task-status/:task_id
========================================================= */

export const updateTaskStatus = async (req, res, next) => {
  try {
    const { task_id } = req.params;

    const requestedStatus = req.body?.status ?? req.query?.status;

    if (!requestedStatus) {
      throw new AppError("Task status is required", 400);
    }

    const normalizedStatus = String(requestedStatus).trim().toLowerCase();

    if (!VALID_STATUSES.includes(normalizedStatus)) {
      throw new AppError(
        `Invalid task status. Allowed values: ${VALID_STATUSES.join(", ")}`,
        400,
      );
    }

    const task = await Task.findById(task_id);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const userId = getAuthUserId(req);

    const isCreator = normalizeId(task.created_by || task.user_id) === String(userId);

    const isAssignee =
      Array.isArray(task.assigned_to) &&
      task.assigned_to.some((id) => normalizeId(id) === String(userId));

    const isSuperAdmin = isSuperAdminUser(req);

    if (!isCreator && !isAssignee && !isSuperAdmin) {
      throw new AppError(
        "Forbidden: You are not allowed to update this task status",
        403,
      );
    }

    const oldStatus = task.status;

    task.status = normalizedStatus;

    await task.save();

    if (task.project) {
      await syncProjectProgress(task.project);
    }

    const populatedTask = await getPopulatedTask(task._id);

    try {
      const recipients = [];

      if (populatedTask?.created_by) {
        recipients.push(populatedTask.created_by);
      }

      if (Array.isArray(populatedTask?.assigned_to)) {
        recipients.push(...populatedTask.assigned_to);
      }

      const uniqueRecipients = Array.from(
        new Map(
          recipients.filter(Boolean).map((user) => [normalizeId(user), user]),
        ).values(),
      );

      const updaterName = getUserName(req);

      for (const recipient of uniqueRecipients) {
        const recipientId = normalizeId(recipient);

        if (!recipientId) continue;

        await sendNotification(
          recipientId,
          `Task "${task.title}" status changed from "${oldStatus}" to "${normalizedStatus}" by ${updaterName}.`,
          "task_status_changed",
          `Task Status Updated: ${task.title}`,
          userId,
          updaterName,
        );

        if (recipient.email) {
          await sendTaskStatusUpdateEmail({
            recipientEmail: recipient.email,

            recipientName: recipient.name || "Team Member",

            taskTitle: task.title,

            oldStatus: oldStatus,

            newStatus: normalizedStatus,

            updatedByName: updaterName,
          });
        }
      }
    } catch (notificationError) {
      console.error(
        "Task status notification failed:",
        notificationError.message,
      );
    }

    return res.status(200).json(formatLeanTask(populatedTask));
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   UPDATE TASK
   PUT /api/v1/tasks/update/:task_id
========================================================= */

export const updateTask = async (req, res, next) => {
  try {
    const { task_id } = req.params;

    if (!isValidObjectId(task_id)) {
      throw new AppError("Invalid task ID", 400);
    }

    const task = await Task.findById(task_id);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const userId = getAuthUserId(req);

    const context = await getUserPermissionContext(req);
    const { isAdminOrHr, isManagerOrLead } = context;

    const isCreator = normalizeId(task.created_by || task.user_id) === String(userId);
    const isSuperAdmin = isSuperAdminUser(req);
    const isAssignee = Array.isArray(task.assigned_to) && task.assigned_to.some((id) => normalizeId(id) === String(userId));

    // Check if request includes self-assignment
    const requestAssignees = req.body?.assigned_to ? parseAssigneeIds(req.body.assigned_to) : [];
    const isSelfAssigning = requestAssignees.includes(String(userId));

    if (!isCreator && !isSuperAdmin && !isAdminOrHr && !isManagerOrLead && !isAssignee && !isSelfAssigning) {
      throw new AppError(
        "Forbidden: You do not have permission to edit or assign this task",
        403,
      );
    }

    const oldProjectId = normalizeId(task.project);

    const {
      title,
      description,
      assigned_to,
      designation_id,
      client,
      project,
      priority,
      dueDate,
      status,
    } = req.body;

    /* Basic fields */

    if (title !== undefined) {
      if (!String(title).trim()) {
        throw new AppError("Task title cannot be empty", 400);
      }

      task.title = String(title).trim();
    }

    if (description !== undefined) {
      task.description = String(description);
    }

    /* Assignees */

    if (assigned_to !== undefined) {
      const assigneeIds = parseAssigneeIds(assigned_to);

      if (assigneeIds.length === 0) {
        throw new AppError("At least one assigned user is required", 400);
      }

      const assigneeCount = await User.countDocuments({
        _id: {
          $in: assigneeIds,
        },
      });

      if (assigneeCount !== assigneeIds.length) {
        throw new AppError("One or more assigned users do not exist", 400);
      }

      task.assigned_to = assigneeIds;
    }

    /* Status */

    if (status !== undefined) {
      const normalizedStatus = String(status).trim().toLowerCase();

      if (!VALID_STATUSES.includes(normalizedStatus)) {
        throw new AppError("Invalid task status", 400);
      }

      task.status = normalizedStatus;
    }

    /* Priority */

    if (priority !== undefined) {
      const normalizedPriority = String(priority).trim().toLowerCase();

      if (!VALID_PRIORITIES.includes(normalizedPriority)) {
        throw new AppError("Invalid task priority", 400);
      }

      task.priority = normalizedPriority;
    }

    /* Due date */

    if (dueDate !== undefined) {
      task.dueDate = parseDueDate(dueDate) || null;
    }

    /* Client */

    if (client !== undefined) {
      task.client =
        client && isValidObjectId(client)
          ? new mongoose.Types.ObjectId(client)
          : null;
    }

    /* Project */

    if (project !== undefined) {
      task.project =
        project && isValidObjectId(project)
          ? new mongoose.Types.ObjectId(project)
          : null;
    }

    /* Designation */

    if (designation_id !== undefined) {
      task.designation_id = designation_id || undefined;
    }

    /* New attachments */

    const filesList = Array.isArray(req.files)
      ? req.files
      : req.file
        ? [req.file]
        : [];

    if (filesList.length > 0) {
      const newAttachments = await processUploadedFiles(filesList, task_id);

      if (!Array.isArray(task.attachments)) {
        task.attachments = [];
      }

      task.attachments.push(...newAttachments);

      if (!task.file_url && newAttachments.length > 0) {
        task.file_url = newAttachments[0].url;

        task.file_public_id = newAttachments[0].public_id;
      }

      if (task.file_url) {
        task.image = task.file_url;
      }
    }

    /* Links */

    if (req.body.links !== undefined) {
      task.links = parseLinks(req.body.links);
    }

    /* Subtasks */

    if (req.body.subtasks !== undefined) {
      task.subtasks = parseSubtasks(req.body.subtasks, userId);
    }

    await task.save();

    /* Project progress */

    const newProjectId = normalizeId(task.project);

    if (oldProjectId && oldProjectId !== newProjectId) {
      await syncProjectProgress(oldProjectId);
    }

    if (newProjectId) {
      await syncProjectProgress(newProjectId);
    }

    const populatedTask = await getPopulatedTask(task._id);

    /* Notifications */

    try {
      const recipients = [];

      if (populatedTask?.created_by) {
        recipients.push(populatedTask.created_by);
      }

      if (Array.isArray(populatedTask?.assigned_to)) {
        recipients.push(...populatedTask.assigned_to);
      }

      const uniqueRecipients = Array.from(
        new Map(
          recipients.filter(Boolean).map((user) => [normalizeId(user), user]),
        ).values(),
      );

      const updaterName = getUserName(req);

      for (const recipient of uniqueRecipients) {
        const recipientId = normalizeId(recipient);

        if (!recipientId) continue;

        await sendNotification(
          recipientId,
          `Task "${task.title}" was updated by ${updaterName}.`,
          "task_updated",
          `Task Updated: ${task.title}`,
          userId,
          updaterName,
        );
      }
    } catch (notificationError) {
      console.error(
        "Task update notification failed:",
        notificationError.message,
      );
    }

    return res.status(200).json(formatLeanTask(populatedTask));
  } catch (error) {
    console.error("UPDATE TASK ERROR:", error);

    next(error);
  }
};

/* =========================================================
   ADD SUBTASK
   POST /api/v1/tasks/:task_id/subtasks
========================================================= */

export const addSubtask = async (req, res, next) => {
  try {
    const { task_id } = req.params;

    const { title } = req.body;

    if (!title?.trim()) {
      throw new AppError("Subtask title is required", 400);
    }

    const task = await Task.findById(task_id);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const userId = getAuthUserId(req);

    const isCreator = normalizeId(task.created_by || task.user_id) === String(userId);

    const isAssignee =
      Array.isArray(task.assigned_to) &&
      task.assigned_to.some((id) => normalizeId(id) === String(userId));

    const isSuperAdmin = isSuperAdminUser(req);

    if (!isCreator && !isAssignee && !isSuperAdmin) {
      throw new AppError(
        "Forbidden: Only the task creator, assignee, or SuperAdmin can add subtasks",
        403,
      );
    }

    if (!Array.isArray(task.subtasks)) {
      task.subtasks = [];
    }

    task.subtasks.push({
      title: title.trim(),
      completed: false,
      created_by: userId,
      completed_by: null,
    });

    await task.save();

    const populatedTask = await getPopulatedTask(task._id);

    /* Notify creator/assignees */

    try {
      const recipients = [];

      if (isCreator) {
        if (Array.isArray(populatedTask?.assigned_to)) {
          recipients.push(...populatedTask.assigned_to);
        }
      } else if (populatedTask?.created_by) {
        recipients.push(populatedTask.created_by);
      }

      const updaterName = getUserName(req);

      for (const recipient of recipients) {
        const recipientId = normalizeId(recipient);

        if (!recipientId || recipientId === String(userId)) {
          continue;
        }

        await sendNotification(
          recipientId,
          `New subtask "${title.trim()}" was added to task "${task.title}" by ${updaterName}.`,
          "subtask_added",
          `Subtask Added: ${task.title}`,
          userId,
          updaterName,
        );
      }
    } catch (notificationError) {
      console.error("Subtask notification failed:", notificationError.message);
    }

    return res.status(201).json(formatLeanTask(populatedTask));
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   UPDATE / TOGGLE SUBTASK
   PUT /api/v1/tasks/:task_id/subtasks/:subtask_id
========================================================= */

export const toggleSubtask = async (req, res, next) => {
  try {
    const { task_id, subtask_id } = req.params;

    if (!isValidObjectId(task_id)) {
      throw new AppError("Invalid task ID", 400);
    }

    const task = await Task.findById(task_id);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const userId = getAuthUserId(req);

    const isCreator = normalizeId(task.created_by || task.user_id) === String(userId);

    const isAssignee =
      Array.isArray(task.assigned_to) &&
      task.assigned_to.some((id) => normalizeId(id) === String(userId));

    const isSuperAdmin = isSuperAdminUser(req);

    if (!isCreator && !isAssignee && !isSuperAdmin) {
      throw new AppError(
        "Forbidden: Only the task creator, assignee, or SuperAdmin can update subtasks",
        403,
      );
    }

    const subtask =
      task.subtasks?.id?.(subtask_id) ||
      task.subtasks?.find(
        (st) => normalizeId(st?._id || st?.id) === String(subtask_id),
      );

    if (!subtask) {
      throw new AppError("Subtask not found", 404);
    }

    const { completed, title } = req.body;

    if (completed !== undefined) {
      subtask.completed = Boolean(completed);

      subtask.completed_by = subtask.completed ? userId : null;
    }

    if (title !== undefined) {
      if (!String(title).trim()) {
        throw new AppError("Subtask title cannot be empty", 400);
      }

      subtask.title = String(title).trim();
    }

    await task.save();

    const populatedTask = await getPopulatedTask(task._id);

    return res.status(200).json(formatLeanTask(populatedTask));
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   DELETE SUBTASK
   DELETE /api/v1/tasks/:task_id/subtasks/:subtask_id
========================================================= */

export const deleteSubtask = async (req, res, next) => {
  try {
    const { task_id, subtask_id } = req.params;

    const task = await Task.findById(task_id);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const userId = getAuthUserId(req);

    const isCreator = normalizeId(task.created_by || task.user_id) === String(userId);

    const isAssignee =
      Array.isArray(task.assigned_to) &&
      task.assigned_to.some((id) => normalizeId(id) === String(userId));

    const isSuperAdmin = isSuperAdminUser(req);

    if (!isCreator && !isAssignee && !isSuperAdmin) {
      throw new AppError(
        "Forbidden: Only the task creator, assignee, or SuperAdmin can delete subtasks",
        403,
      );
    }

    const originalLength = task.subtasks?.length || 0;

    task.subtasks = (task.subtasks || []).filter(
      (st) => normalizeId(st?._id || st?.id) !== String(subtask_id),
    );

    if (task.subtasks.length === originalLength) {
      throw new AppError("Subtask not found", 404);
    }

    await task.save();

    const populatedTask = await getPopulatedTask(task._id);

    return res.status(200).json(formatLeanTask(populatedTask));
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   TASK COLLABORATION - ADD COMMENT
   POST /api/v1/tasks/:task_id/comments
========================================================= */

export const addTaskComment = async (req, res, next) => {
  try {
    const { task_id } = req.params;

    if (!isValidObjectId(task_id)) {
      throw new AppError("Invalid task ID", 400);
    }

    const userId = getAuthUserId(req);

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const task = await Task.findById(task_id);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    /* ---------------------------------------------------------
       PERMISSION
    --------------------------------------------------------- */

    const isCreator = normalizeId(task.created_by || task.user_id) === String(userId);

    const isAssignee =
      Array.isArray(task.assigned_to) &&
      task.assigned_to.some((id) => normalizeId(id) === String(userId));

    const isSuperAdmin = isSuperAdminUser(req);

    if (!isCreator && !isAssignee && !isSuperAdmin) {
      throw new AppError(
        "Forbidden: Only the task creator, assignee, or SuperAdmin can comment on this task",
        403,
      );
    }

    /* ---------------------------------------------------------
       COMMENT TEXT
    --------------------------------------------------------- */

    const commentText = String(
      req.body?.comment || req.body?.text || req.body?.content || "",
    ).trim();

    /* ---------------------------------------------------------
       FILES
    --------------------------------------------------------- */

    const filesList = Array.isArray(req.files)
      ? req.files
      : req.file
        ? [req.file]
        : [];

    if (!commentText && filesList.length === 0) {
      throw new AppError("Comment text or attachment is required", 400);
    }

    if (commentText.length > 5000) {
      throw new AppError("Comment cannot exceed 5000 characters", 400);
    }

    /* ---------------------------------------------------------
       UPLOAD COMMENT ATTACHMENTS
    --------------------------------------------------------- */

    const uploadedAttachments = await processUploadedFiles(filesList, `task-comment-${task_id}`);

    /* ---------------------------------------------------------
       CREATE COMMENT
    --------------------------------------------------------- */

    if (!Array.isArray(task.comments)) {
      task.comments = [];
    }

    task.comments.push({
      author: userId,
      comment: commentText,
      attachments: uploadedAttachments,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await task.save();

    /* ---------------------------------------------------------
       GET POPULATED TASK
    --------------------------------------------------------- */

    const populatedTask = await getPopulatedTask(task._id);

    /* ---------------------------------------------------------
       NOTIFICATIONS
    --------------------------------------------------------- */

    try {
      const recipients = [];

      if (populatedTask?.created_by) {
        recipients.push(populatedTask.created_by);
      }

      if (Array.isArray(populatedTask?.assigned_to)) {
        recipients.push(...populatedTask.assigned_to);
      }

      const uniqueRecipients = Array.from(
        new Map(
          recipients.filter(Boolean).map((user) => [normalizeId(user), user]),
        ).values(),
      );

      const commenterName = getUserName(req);

      for (const recipient of uniqueRecipients) {
        const recipientId = normalizeId(recipient);

        if (!recipientId || recipientId === String(userId)) {
          continue;
        }

        await sendNotification(
          recipientId,
          `${commenterName} added a comment to task "${task.title}".`,
          "task_comment_added",
          `New Comment: ${task.title}`,
          userId,
          commenterName,
        );
      }
    } catch (notificationError) {
      console.error("Comment notification failed:", notificationError.message);
    }

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      task: formatLeanTask(populatedTask),
    });
  } catch (error) {
    console.error("ADD TASK COMMENT ERROR:", error);

    next(error);
  }
};

/* =========================================================
   TASK COLLABORATION - UPDATE COMMENT
   PUT /api/v1/tasks/:task_id/comments/:comment_id
========================================================= */

export const updateTaskComment = async (req, res, next) => {
  try {
    const { task_id, comment_id } = req.params;

    if (!isValidObjectId(task_id)) {
      throw new AppError("Invalid task ID", 400);
    }

    if (!isValidObjectId(comment_id)) {
      throw new AppError("Invalid comment ID", 400);
    }

    const userId = getAuthUserId(req);

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const task = await Task.findById(task_id);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    if (!Array.isArray(task.comments)) {
      throw new AppError("Comment not found", 404);
    }

    const comment = task.comments?.id
      ? task.comments.id(comment_id)
      : task.comments?.find((c) => String(c._id || c.id) === String(comment_id));

    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    /* ---------------------------------------------------------
       PERMISSION
    --------------------------------------------------------- */

    const isCommentAuthor =
      normalizeId(comment.author || comment.user || comment.user_id || comment.created_by) ===
      String(userId);

    const isTaskCreator = normalizeId(task.created_by || task.user_id) === String(userId);

    const isSuperAdmin = isSuperAdminUser(req);

    if (!isCommentAuthor && !isTaskCreator && !isSuperAdmin) {
      throw new AppError("Forbidden: You can only edit your own comments", 403);
    }

    /* ---------------------------------------------------------
       COMMENT TEXT
    --------------------------------------------------------- */

    const commentText =
      req.body?.comment !== undefined
        ? String(req.body.comment).trim()
        : req.body?.text !== undefined
          ? String(req.body.text).trim()
          : req.body?.content !== undefined
            ? String(req.body.content).trim()
            : undefined;

    if (commentText !== undefined && commentText.length > 5000) {
      throw new AppError("Comment cannot exceed 5000 characters", 400);
    }

    /* ---------------------------------------------------------
       UPDATE TEXT
    --------------------------------------------------------- */

    if (commentText !== undefined) {
      if (!commentText && (!Array.isArray(comment.attachments) || comment.attachments.length === 0)) {
        throw new AppError("Comment cannot be empty", 400);
      }

      comment.comment = commentText;
      comment.text = commentText;
    }

    /* ---------------------------------------------------------
       NEW ATTACHMENTS
    --------------------------------------------------------- */

    const filesList = Array.isArray(req.files)
      ? req.files
      : req.file
        ? [req.file]
        : [];

    if (filesList.length > 0) {
      const newAttachments = await processUploadedFiles(filesList, `task-comment-update-${task_id}`);

      if (!Array.isArray(comment.attachments)) {
        comment.attachments = [];
      }

      comment.attachments.push(...newAttachments);
    }

    comment.updatedAt = new Date();

    await task.save();

    const populatedTask = await getPopulatedTask(task._id);

    return res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      task: formatLeanTask(populatedTask),
    });
  } catch (error) {
    console.error("UPDATE TASK COMMENT ERROR:", error);

    next(error);
  }
};

/* =========================================================
   TASK COLLABORATION - DELETE COMMENT
   DELETE /api/v1/tasks/:task_id/comments/:comment_id
========================================================= */

export const deleteTaskComment = async (req, res, next) => {
  try {
    const { task_id, comment_id } = req.params;

    if (!isValidObjectId(task_id)) {
      throw new AppError("Invalid task ID", 400);
    }

    if (!isValidObjectId(comment_id)) {
      throw new AppError("Invalid comment ID", 400);
    }

    const userId = getAuthUserId(req);

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const task = await Task.findById(task_id);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    if (!Array.isArray(task.comments)) {
      throw new AppError("Comment not found", 404);
    }

    const comment = task.comments?.id
      ? task.comments.id(comment_id)
      : task.comments?.find((c) => String(c._id || c.id) === String(comment_id));

    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    /* ---------------------------------------------------------
       PERMISSION
    --------------------------------------------------------- */

    const isCommentAuthor =
      normalizeId(comment.author || comment.user || comment.user_id || comment.created_by) ===
      String(userId);

    const isTaskCreator = normalizeId(task.created_by || task.user_id) === String(userId);

    const isSuperAdmin = isSuperAdminUser(req);

    if (!isCommentAuthor && !isTaskCreator && !isSuperAdmin) {
      throw new AppError(
        "Forbidden: You can only delete your own comments",
        403,
      );
    }

    /* ---------------------------------------------------------
       DELETE LOCAL FILES
    --------------------------------------------------------- */

    if (Array.isArray(comment.attachments)) {
      for (const attachment of comment.attachments) {
        await deleteLocalAttachmentFile(attachment);
      }
    }

    /* ---------------------------------------------------------
       REMOVE COMMENT
    --------------------------------------------------------- */

    if (typeof comment.deleteOne === "function") {
      comment.deleteOne();
    } else if (typeof task.comments.pull === "function") {
      task.comments.pull(comment_id);
    } else {
      task.comments = task.comments.filter(
        (c) => String(c._id || c.id) !== String(comment_id),
      );
    }

    await task.save();

    const populatedTask = await getPopulatedTask(task._id);

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      task: formatLeanTask(populatedTask),
    });
  } catch (error) {
    console.error("DELETE TASK COMMENT ERROR:", error);

    next(error);
  }
};

/* =========================================================
   TASK COLLABORATION - TASK ATTACHMENTS
========================================================= */

export const getTaskComments = async (req, res, next) => {
  try {
    const { task_id } = req.params;

    if (!isValidObjectId(task_id)) {
      throw new AppError("Invalid task ID", 400);
    }

    const userId = getAuthUserId(req);

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const task = await Task.findById(task_id);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const isCreator = normalizeId(task.created_by || task.user_id) === String(userId);
    const isAssignee =
      Array.isArray(task.assigned_to) &&
      task.assigned_to.some(
        (assignee) => normalizeId(assignee) === String(userId),
      );

    if (!isCreator && !isAssignee && !isSuperAdminUser(req)) {
      throw new AppError(
        "Forbidden: You do not have access to this task's comments",
        403,
      );
    }

    await task.populate("comments.author", "name email");

    return res.status(200).json({
      success: true,
      comments: Array.isArray(task.comments)
        ? task.comments.map((comment) =>
            typeof comment.toObject === "function"
              ? comment.toObject()
              : comment,
          )
        : [],
    });
  } catch (error) {
    next(error);
  }
};

export const addTaskAttachments = async (req, res, next) => {
  try {
    const { task_id } = req.params;

    if (!isValidObjectId(task_id)) {
      throw new AppError("Invalid task ID", 400);
    }

    const userId = getAuthUserId(req);

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const task = await Task.findById(task_id);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const isCreator = normalizeId(task.created_by || task.user_id) === String(userId);
    const isAssignee =
      Array.isArray(task.assigned_to) &&
      task.assigned_to.some(
        (assignee) => normalizeId(assignee) === String(userId),
      );

    if (!isCreator && !isAssignee && !isSuperAdminUser(req)) {
      throw new AppError(
        "Forbidden: You do not have access to add attachments to this task",
        403,
      );
    }

    const files = Array.isArray(req.files)
      ? req.files
      : req.file
        ? [req.file]
        : [];

    if (files.length === 0) {
      throw new AppError("At least one attachment is required", 400);
    }

    const attachments = await processUploadedFiles(files, task_id);

    if (attachments.length === 0) {
      throw new AppError("No attachments could be uploaded", 400);
    }

    task.attachments ??= [];
    task.attachments.push(
      ...attachments.map((attachment) => ({
        ...attachment,
        size:
          Number(
            files.find((file) => file.originalname === attachment.name)?.size,
          ) || 0,
        uploaded_by: userId,
        uploadedAt: new Date(),
      })),
    );

    await task.save();

    const populatedTask = await getPopulatedTask(task._id);

    return res.status(201).json({
      success: true,
      message: "Attachments added successfully",
      task: formatLeanTask(populatedTask),
    });
  } catch (error) {
    console.error("ADD TASK ATTACHMENTS ERROR:", error);
    next(error);
  }
};

export const deleteTaskAttachment = async (req, res, next) => {
  try {
    const { task_id, attachment_id } = req.params;

    if (!isValidObjectId(task_id)) {
      throw new AppError("Invalid task ID", 400);
    }

    if (!isValidObjectId(attachment_id)) {
      throw new AppError("Invalid attachment ID", 400);
    }

    const userId = getAuthUserId(req);

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const task = await Task.findById(task_id);

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const attachment = task.attachments?.id
      ? task.attachments.id(attachment_id)
      : task.attachments?.find((a) => String(a._id || a.id) === String(attachment_id));

    if (!attachment) {
      throw new AppError("Attachment not found", 404);
    }

    const isCreator = normalizeId(task.created_by || task.user_id) === String(userId);
    const isUploader = normalizeId(attachment.uploaded_by) === String(userId);

    if (!isCreator && !isUploader && !isSuperAdminUser(req)) {
      throw new AppError(
        "Forbidden: You can only delete attachments you uploaded",
        403,
      );
    }

    await deleteLocalAttachmentFile(attachment);

    if (typeof attachment.deleteOne === "function") {
      attachment.deleteOne();
    } else if (typeof task.attachments.pull === "function") {
      task.attachments.pull(attachment_id);
    } else {
      task.attachments = task.attachments.filter(
        (a) => String(a._id || a.id) !== String(attachment_id),
      );
    }

    await task.save();

    const populatedTask = await getPopulatedTask(task._id);

    return res.status(200).json({
      success: true,
      message: "Attachment deleted successfully",
      task: formatLeanTask(populatedTask),
    });
  } catch (error) {
    console.error("DELETE TASK ATTACHMENT ERROR:", error);
    next(error);
  }
};
