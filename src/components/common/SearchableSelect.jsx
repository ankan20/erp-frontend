"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select",
  disabled = false,
  className = "",
  searchKeys = [],
  labelKey = "label",
  valueKey = "value",
  emptyText = "No Data Found",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const wrapperRef = useRef(null);

  // CLOSE OUTSIDE
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  // SELECTED OPTION
  const selectedOption = useMemo(() => {
    return options.find(
      (item) => String(item[valueKey]) === String(value)
    );
  }, [options, value, valueKey]);

  // FILTERED OPTIONS
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;

    const lowerSearch = search.toLowerCase();

    return options.filter((item) => {
      return searchKeys.some((key) => {
        return String(item[key] || "")
          .toLowerCase()
          .includes(lowerSearch);
      });
    });
  }, [search, options, searchKeys]);

  const handleSelect = (item) => {
    onChange(item[valueKey], item);
    setOpen(false);
    setSearch("");
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full ${className}`}
    >
      {/* SELECT BUTTON */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`
          w-full
          h-[30px]
          border border-[#8f8f8f]
          rounded-sm
          bg-white
          px-2
          text-left
          text-[13px]
          font-normal
          flex
          items-center
          justify-between
          disabled:bg-gray-100
          disabled:text-gray-500
          disabled:cursor-not-allowed
        `}
      >
        <span className="truncate">
          {selectedOption
            ? selectedOption[labelKey]
            : placeholder}
        </span>

        <ChevronDown size={16} />
      </button>

      {/* DROPDOWN */}
      {open && !disabled && (
        <div
          className="
            absolute
            top-full
            left-0
            z-50
            mt-1
            w-full
            border
            border-[#8f8f8f]
            rounded-sm
            bg-white
            shadow-md
          "
        >
          {/* SEARCH */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="
                w-full
                h-[30px]
                border border-[#8f8f8f]
                rounded-sm
                px-2
                text-[13px]
                font-normal
                outline-none
              "
            />
          </div>

          {/* OPTIONS */}
          <div className="max-h-[220px] overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((item) => {
                const isSelected =
                  String(item[valueKey]) === String(value);

                return (
                  <button
                    type="button"
                    key={item[valueKey]}
                    onClick={() => handleSelect(item)}
                    className={`
                      w-full
                      text-left
                      px-3
                      py-2
                      text-[13px]
                      hover:bg-[#d6e6f2]
                      border-b
                      border-gray-100
                      ${
                        isSelected
                          ? "bg-[#d6e6f2]"
                          : "bg-white"
                      }
                    `}
                  >
                    {item[labelKey]}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-[13px] text-gray-500">
                {emptyText}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// example usage

// <SearchableSelect
//   options={vendorList}
//   value={watch("vendorId")}
//   onChange={(value) => setValue("vendorId", value)}
//   placeholder="Select Vendor"
//   labelKey="vendorName"
//   valueKey="vendorId"
//   searchKeys={["vendorName", "vendorCode", "mobile"]}
// />