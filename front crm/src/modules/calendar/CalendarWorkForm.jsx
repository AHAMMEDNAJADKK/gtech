import React, { useState, useEffect } from "react";
import { AlertCircle, ImagePlus, Trash2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { resolveCalendarImageUrl, fetchContentTypes } from "../../services/calendarService";
import ManageContentTypesModal from "./ManageContentTypesModal";

const DEFAULT_CONTENT_TYPES = [
  { value: "instagram_post", name: "Instagram Post" },
  { value: "instagram_story", name: "Instagram Story" },
  { value: "facebook_post", name: "Facebook Post" },
  { value: "facebook_story", name: "Facebook Story" },
  { value: "blog_post", name: "Blog Post" },
  { value: "youtube_video", name: "YouTube Video" },
  { value: "newsletter", name: "Newsletter" },
  { value: "twitter_post", name: "Twitter/X Post" },
  { value: "tiktok_video", name: "TikTok Video" },
  { value: "email_campaign", name: "Email Campaign" },
  { value: "web_banner", name: "Web Banner" },
  { value: "linkedin_post", name: "LinkedIn Post" },
  { value: "other", name: "Other" },
];

const emptyForm = {
  title: "",
  description: "",
  contentType: "",
  assignedTo: "",
  workDate: "",
  workDueDate: "",
  postingDate: "",
  postingTime: "",
  project: "",
  client: "",
  campaign: "",
  isUrgent: false,
  tags: "",
};

const toInputDate = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Compact create/edit form with live image preview
 */
const CalendarWorkForm = ({
  initialData = null,
  employees = [],
  onSubmit,
  loading = false,
  error = null,
}) => {
  const [formData, setFormData] = useState(emptyForm);
  const [validationErrors, setValidationErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);

  // Dynamic Content Types State & Modal Toggle
  const [contentTypes, setContentTypes] = useState(DEFAULT_CONTENT_TYPES);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  const loadContentTypes = async () => {
    try {
      const res = await fetchContentTypes();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setContentTypes(res.data);
      }
    } catch (err) {
      console.warn("Error fetching content types:", err);
    }
  };

  useEffect(() => {
    loadContentTypes();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        description: initialData.description || "",
        contentType: initialData.contentType || "",
        assignedTo: initialData.assignedTo?._id || initialData.assignedTo || "",
        workDate: toInputDate(initialData.workDate),
        workDueDate: toInputDate(initialData.workDueDate),
        postingDate: toInputDate(initialData.postingDate),
        postingTime: initialData.postingTime || "",
        project: initialData.project?._id || initialData.project || "",
        client: initialData.client?._id || initialData.client || "",
        campaign: initialData.campaign || "",
        isUrgent: initialData.isUrgent || false,
        tags: Array.isArray(initialData.tags)
          ? initialData.tags.join(", ")
          : "",
      });
      setImageFile(null);
      setRemoveImage(false);
      setImagePreview(resolveCalendarImageUrl(initialData.imageUrl) || "");
    } else {
      setFormData(emptyForm);
      setImageFile(null);
      setRemoveImage(false);
      setImagePreview("");
    }
  }, [initialData]);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const validateForm = () => {
    const errors = {};

    if (!formData.title?.trim()) {
      errors.title = "Title is required";
    } else if (formData.title.length < 3) {
      errors.title = "Title must be at least 3 characters";
    } else if (formData.title.length > 500) {
      errors.title = "Title must not exceed 500 characters";
    }

    if (!formData.contentType) {
      errors.contentType = "Content type is required";
    }

    if (!formData.assignedTo) {
      errors.assignedTo = "Assigned to is required";
    }

    if (formData.description && formData.description.length > 3000) {
      errors.description = "Description must not exceed 3000 characters";
    }

    if (formData.postingTime && !/^\d{2}:\d{2}$/.test(formData.postingTime)) {
      errors.postingTime = "Posting time must be in HH:MM format";
    }

    if (imageFile && !String(imageFile.type || "").startsWith("image/")) {
      errors.image = "Please choose a valid image file";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
    setValidationErrors((prev) => ({ ...prev, image: undefined }));
  };

  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview("");
    setRemoveImage(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const cleanedFormData = { ...formData };

    [
      "project",
      "client",
      "workDate",
      "workDueDate",
      "postingDate",
      "postingTime",
      "campaign",
    ].forEach((field) => {
      if (!cleanedFormData[field] || String(cleanedFormData[field]).trim() === "") {
        delete cleanedFormData[field];
      }
    });

    const submitData = {
      ...cleanedFormData,
      tags: formData.tags
        ? formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    };

    if (imageFile || removeImage) {
      const payload = new FormData();
      Object.entries(submitData).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          payload.append(key, JSON.stringify(value));
        } else if (typeof value === "boolean") {
          payload.append(key, String(value));
        } else {
          payload.append(key, value);
        }
      });
      if (imageFile) {
        payload.append("image", imageFile);
      }
      if (removeImage && !imageFile) {
        payload.append("removeImage", "true");
        payload.append("imageUrl", "");
      }
      onSubmit(payload);
      return;
    }

    onSubmit(submitData);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const fieldClass = (hasError) =>
    `w-full px-3 py-2 rounded-lg border text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
      hasError
        ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20"
        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
    }`;

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700 dark:text-rose-200">{error}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Instagram Carousel Post"
            maxLength={500}
            className={fieldClass(validationErrors.title)}
          />
          {validationErrors.title && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
              {validationErrors.title}
            </p>
          )}
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Add any additional details..."
            maxLength={3000}
            rows={2}
            className={fieldClass(false)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Content Type <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setIsManageModalOpen(true)}
              className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
              title="Manage Content Types (Add, Edit, Delete)"
            >
              <Plus size={12} />
              <span>Add / Edit</span>
            </button>
          </div>
          <select
            name="contentType"
            value={formData.contentType}
            onChange={handleChange}
            className={fieldClass(validationErrors.contentType)}
          >
            <option value="">Select type...</option>
            {contentTypes.map((ct) => {
              const val = ct.value || ct._id || ct.name;
              const lbl = ct.name || ct.label || ct.value;
              return (
                <option key={ct._id || val} value={val}>
                  {lbl}
                </option>
              );
            })}
          </select>
          {validationErrors.contentType && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
              {validationErrors.contentType}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Assigned To <span className="text-rose-500">*</span>
          </label>
          <select
            name="assignedTo"
            value={formData.assignedTo}
            onChange={handleChange}
            className={fieldClass(validationErrors.assignedTo)}
          >
            <option value="">Select employee...</option>
            {employees.map((emp, index) => {
              const empId = emp._id || emp.id || `emp-${index}`;
              return (
                <option key={empId} value={emp._id || emp.id || ""}>
                  {emp.name || emp.email || "Unknown User"}
                </option>
              );
            })}
          </select>
          {validationErrors.assignedTo && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
              {validationErrors.assignedTo}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Work Date
          </label>
          <input
            type="date"
            name="workDate"
            value={formData.workDate}
            onChange={handleChange}
            className={fieldClass(false)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Due Date
          </label>
          <input
            type="date"
            name="workDueDate"
            value={formData.workDueDate}
            onChange={handleChange}
            className={fieldClass(false)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Posting Date
          </label>
          <input
            type="date"
            name="postingDate"
            value={formData.postingDate}
            onChange={handleChange}
            className={fieldClass(false)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Posting Time
          </label>
          <input
            type="time"
            name="postingTime"
            value={formData.postingTime}
            onChange={handleChange}
            className={fieldClass(validationErrors.postingTime)}
          />
          {validationErrors.postingTime && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
              {validationErrors.postingTime}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Campaign
          </label>
          <input
            type="text"
            name="campaign"
            value={formData.campaign}
            onChange={handleChange}
            placeholder="e.g., Summer Sale 2026"
            className={fieldClass(false)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Tags
          </label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            placeholder="featured, urgent"
            className={fieldClass(false)}
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Image
          </label>
          <label className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:border-emerald-500 hover:text-emerald-500 transition">
            <ImagePlus className="w-4 h-4" />
            {imageFile ? imageFile.name : "Upload image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </label>
          {validationErrors.image && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
              {validationErrors.image}
            </p>
          )}
          {imagePreview && (
            <div className="mt-2 relative">
              <img
                src={imagePreview}
                alt="Work preview"
                className="w-full h-28 object-cover rounded-lg border border-slate-700/50"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/80 text-[11px] font-semibold text-white hover:bg-rose-600 transition"
              >
                <Trash2 className="w-3 h-3" />
                Remove Image
              </button>
            </div>
          )}
        </div>

        <div className="col-span-2 flex items-center gap-3">
          <input
            type="checkbox"
            id="isUrgent"
            name="isUrgent"
            checked={formData.isUrgent}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
          />
          <label
            htmlFor="isUrgent"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Mark as Urgent
          </label>
        </div>
      </div>

        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: loading ? 1 : 1.02 }}
          whileTap={{ scale: loading ? 1 : 0.98 }}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? "Saving..."
            : initialData?._id || initialData?.id
              ? "Update Work"
              : "Create Work"}
        </motion.button>
      </form>

      {/* Modal to Add, Edit & Delete Content Types (Rendered outside form to avoid DOM nesting warnings) */}
      <ManageContentTypesModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        onContentTypesUpdated={(updatedList, newlyAddedValue) => {
          setContentTypes(updatedList);
          if (newlyAddedValue) {
            setFormData((prev) => ({ ...prev, contentType: newlyAddedValue }));
            if (validationErrors.contentType) {
              setValidationErrors((prev) => ({ ...prev, contentType: null }));
            }
          }
        }}
      />
    </>
  );
};

export default CalendarWorkForm;
