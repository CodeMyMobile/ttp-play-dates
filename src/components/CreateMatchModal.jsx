import React, { useState } from "react";
import { X, Calendar, Clock, Users, MapPin, FileText } from "lucide-react";
import { createMatch } from "../services/matches";

const CreateMatchModal = ({ isOpen, onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    visibility: "open",
    date: "",
    startTime: "",
    duration: "2",
    location: "",
    playerLimit: "4",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.location.trim()) {
      newErrors.location = "Location is required";
    }
    if (!formData.date) {
      newErrors.date = "Date is required";
    }
    if (!formData.startTime) {
      newErrors.startTime = "Start time is required";
    }
    if (!formData.playerLimit || parseInt(formData.playerLimit) < 2 || parseInt(formData.playerLimit) > 16) {
      newErrors.playerLimit = "Player limit must be between 2 and 16";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Build the payload aligned with backend naming conventions
      const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
      
      const payload = {
        match_type: formData.visibility === "open" ? "open" : "private",
        start_date_time: startDateTime.toISOString(),
        player_limit: parseInt(formData.playerLimit),
        location_text: formData.location.trim(),
        duration_hours: parseFloat(formData.duration),
        notes: formData.notes.trim() || null,
        status: "open", // Set to open by default as per existing pattern
      };

      const response = await createMatch(payload);
      
      // Reset form
      setFormData({
        visibility: "open",
        date: "",
        startTime: "",
        duration: "2",
        location: "",
        playerLimit: "4",
        notes: "",
      });
      setErrors({});
      
      // Call the onCreated callback with the response
      if (onCreated) {
        onCreated(response);
      }
      
      onClose();
    } catch (error) {
      setErrors({
        submit: error?.message || "Failed to create match. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        visibility: "open",
        date: "",
        startTime: "",
        duration: "2",
        location: "",
        playerLimit: "4",
        notes: "",
      });
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  const isFormValid = 
    formData.location.trim() &&
    formData.date &&
    formData.startTime &&
    formData.playerLimit &&
    parseInt(formData.playerLimit) >= 2 &&
    parseInt(formData.playerLimit) <= 16;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-2xl font-black text-gray-900">Create New Match</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Match Visibility */}
          <div>
            <label className="block text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">
              Match Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  id: "open",
                  label: "Open Match",
                  desc: "Anyone can join",
                  icon: "🌍",
                },
                {
                  id: "private",
                  label: "Private Match",
                  desc: "Invite only",
                  icon: "🔒",
                },
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, visibility: type.id }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.visibility === type.id
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="text-2xl mb-2">{type.icon}</div>
                  <div className="font-bold text-gray-900">{type.label}</div>
                  <div className="text-sm text-gray-600">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
              Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800 ${
                  errors.date ? "border-red-300" : "border-gray-200"
                }`}
              />
            </div>
            {errors.date && <p className="text-sm text-red-600 mt-1">{errors.date}</p>}
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
              Start Time <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800 ${
                  errors.startTime ? "border-red-300" : "border-gray-200"
                }`}
              />
            </div>
            {errors.startTime && <p className="text-sm text-red-600 mt-1">{errors.startTime}</p>}
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
              Duration (hours)
            </label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
            >
              <option value="1">1 hour</option>
              <option value="1.5">1.5 hours</option>
              <option value="2">2 hours</option>
              <option value="2.5">2.5 hours</option>
              <option value="3">3 hours</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
              Location <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Enter tennis court or venue name"
                className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800 ${
                  errors.location ? "border-red-300" : "border-gray-200"
                }`}
              />
            </div>
            {errors.location && <p className="text-sm text-red-600 mt-1">{errors.location}</p>}
          </div>

          {/* Player Limit */}
          <div>
            <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
              Player Limit <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={formData.playerLimit}
                onChange={(e) => setFormData(prev => ({ ...prev, playerLimit: e.target.value }))}
                className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800 ${
                  errors.playerLimit ? "border-red-300" : "border-gray-200"
                }`}
              >
                {Array.from({ length: 15 }, (_, i) => i + 2).map(num => (
                  <option key={num} value={num.toString()}>
                    {num} players
                  </option>
                ))}
              </select>
            </div>
            {errors.playerLimit && <p className="text-sm text-red-600 mt-1">{errors.playerLimit}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
              Notes (Optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any additional details or requirements..."
                rows={3}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800 resize-none"
              />
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:transform-none disabled:shadow-none"
            >
              {isSubmitting ? "Creating..." : "Create Match"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMatchModal;