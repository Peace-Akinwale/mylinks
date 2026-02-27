"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export default function UserMenu({ email }: { email: string | undefined }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:flex items-center gap-4">
        <span className="text-sm text-gray-500">{email}</span>
        <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
          Settings
        </Link>
        <form action="/api/auth/signout" method="POST">
          <button className="text-sm text-gray-600 hover:text-gray-900">
            Sign out
          </button>
        </form>
      </div>

      {/* Mobile */}
      <div className="sm:hidden relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
          aria-label="Menu"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
            <div className="px-3 py-2 text-xs text-gray-400 truncate border-b border-gray-100">
              {email}
            </div>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Settings
            </Link>
            <form action="/api/auth/signout" method="POST">
              <button
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setOpen(false)}
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
