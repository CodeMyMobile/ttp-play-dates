import React from "react";
import { ChevronLeft, LogOut, Bell } from "lucide-react";

const AppHeader = ({
  currentScreen,
  currentUser,
  showPreview,
  goToInvites,
  goToBrowse,
  onOpenProfile,
  onLogout,
  onOpenSignIn,
  setShowPreview,
}) => {
  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-50 backdrop-blur-lg bg-white/95">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {currentScreen === "browse" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl">🎾</span>
              </div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Matchplay
              </h1>
            </div>
            {currentUser ? (
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
                <button
                  onClick={goToInvites}
                  className="relative rounded-xl p-2.5 transition-colors hover:bg-gray-50"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                </button>
                <button
                  onClick={onOpenProfile}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all hover:bg-gray-50"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                    {currentUser.avatar}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold text-gray-800">
                      {currentUser.name.split(" ")[0]}
                    </span>
                    {currentUser.skillLevel && (
                      <span className="text-xs font-semibold text-gray-500">
                        NTRP {currentUser.skillLevel}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all hover:bg-gray-50"
                >
                  <LogOut className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-bold text-gray-800">Log Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenSignIn}
                className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl sm:w-auto"
              >
                Sign In
              </button>
            )}
          </div>
        ) : currentScreen === "invites" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={goToBrowse}
              className="flex items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-gray-50"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
              <span className="text-gray-700 font-bold">Back</span>
            </button>
            <h1 className="text-xl font-black text-gray-800">Invites</h1>
            {currentUser && (
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                {currentUser.avatar}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                if (showPreview) {
                  setShowPreview?.(false);
                } else {
                  goToBrowse();
                }
              }}
              className="flex items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-gray-50"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
              <span className="text-gray-700 font-bold">Back</span>
            </button>
            {currentUser && (
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                {currentUser.avatar}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppHeader;

